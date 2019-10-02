import { Mongo } from 'meteor/mongo';
import { HTTP } from 'meteor/http';
import { check, Match } from 'meteor/check';
import { Session } from 'meteor/session';
import { addAllCourses, findCurrSemester, findAllSemesters, addCrossList, updateProfessors, resetProfessorArray } from './dbInit.js';
import { Classes, Students, Subjects, Reviews, Validation } from '../imports/api/dbDefs.js';
import {getGaugeValues} from '../imports/ui/js/CourseCard.js';

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client("836283700372-msku5vqaolmgvh3q1nvcqm3d6cgiu0v1.apps.googleusercontent.com");
/* # Meteor Methods
   # Client-side code in meteor is not allowed direct access to the local database
   # (this makes it easier to keep the backend secure from outside users).
   # Instead, the Client interacts with the database through the functions definied below,
   # which can be initiated by the Client but run on the Server.
*/
Meteor.methods({
  // insert a new review into the reviews collection. Also updates 
  // course metrics upon successfully inserting review.
  // Upon success returns 1, else returns 0.
  insert: function (review, classId) {
    // check: only insert if all form fields are filled in
    if (review.text !== null && review.diff !== null && review.rating !== null && review.workload !== null && review.professors !== null && classId !== undefined && classId !== null) {
      var fullReview = {
        text: review.text,
        difficulty: review.diff,
        rating: review.rating,
        workload: review.workload,
        class: classId,
        date: new Date(),
        visible: 0,
        reported: 0,
        professors: review.professors,
        likes: 0,
      };

      try {
        //check(fullReview, Reviews);
        Reviews.insert(fullReview);
        //Update the course metrics
        Meteor.call("updateCourseMetrics", classId);
        return 1; //success
      } catch (error) {
        console.log(error)
        return 0; //fail
      }
    } else {
      //error handling
      console.log("Some review values are null")
      return 0; //fail
    }
  },

  //Inserts a new user into the Users collection.
  //Upon success returns 1, else returns 0
  insertUser: function (user) {
    //Check user object has all required fields
    if (user.firstName != null && user.lastName != null && user.netId != null && user.token != null && user.privilege != null) {
      var newUser = {
        firstName: user.firstName,
        lastName: user.lastName,
        netId: user.netId,
        affiliation: null,
        token: user.token,
        privilege: user.privilege
      };

      try {
        //check(newUser, Users);
        Students.insert(newUser);
        return 1; //success
      } catch (error) {
        console.log(error)
        return 0; //fail
      }

    }
    else {
      //error handling
      console.log("Some user values are null")
      return 0; //fail
    }
  },

  //Increment the number of likes a review has gotten by 1.
  incrementLike: function (review) {
    try {
      if (review.likes == undefined) {
        Reviews.update(review._id, { $set: { likes: 1 } });
      }
      else {
        Reviews.update(review._id, { $set: { likes: review.likes + 1 } });
      }
      return 1;
    }
    catch (error) {
      return 0;
    }
  },

  //Decrement the number of likes a review has gotten by 1.
  decrementLike: function (review) {
    try {
      if (review.likes == undefined) {
        Reviews.update(review._id, { $set: { likes: 1 } });
      }
      else {
        Reviews.update(review._id, { $set: { likes: review.likes - 1 } });
      }
      return 1;
    }
    catch (error) {
      return 0;
    }
  },

  // Make this reveiw visible to everyone (ex: un-report a review)
  // Upon succcess, return 1, else 0.
  makeVisible: function (review) {
    // check: make sure review id is valid and non-malicious
    var regex = new RegExp(/^(?=.*[A-Z0-9])/i);
    if (regex.test(review._id)) {
      Reviews.update(review._id, { $set: { visible: 1 } });
      return 1;
    } else {
      return 0;
    }
  },

  // Delete this review from the local database.
  // Upon succcess, return 1, else 0.
  removeReview: function (review) {
    // check: make sure review id is valid and non-malicious
    var regex = new RegExp(/^(?=.*[A-Z0-9])/i);
    if (regex.test(review._id)) {
      // Reviews.remove({ _id: review._id });
      return 1;
    } else {
      return 0;
    }
  },

  // This updates the metrics for an individual class given its Mongo-generated id. 
  // Returns 1 if successful, 0 otherwise.
  updateCourseMetrics : function (courseId){
    var course = Meteor.call('getCourseById', courseId);
    if(course){
        var reviews=Reviews.find({class: courseId }).fetch();
        var state=getGaugeValues(reviews);
       if( typeof state.rating == 'string' && typeof state.workload == 'string' && typeof state.diff == 'string' && typeof state.grade == 'number' )
       {
        Classes.update({ _id: courseId }, { $set: { classRating: Number(state.rating), classWorkload: Number(state.workload), 
        classDifficulty:Number(state.diff), classGrade:state.gradeNum } });}

        return 1;
      
    }
    else{
      return 0;
    }

    },

    // Used to update the review metrics for all courses
    //in the database.
    updateMetricsForAllCourses: function (){
      var courses=Classes.find().fetch();
      courses.forEach(function(course){
        Meteor.call("updateCourseMetrics", course._id);
      });
    },

    // Returns courses with the given parameters.
    // Takes in a dictionary object of field names
    // and the desired value, i.e. 
    // {"classRating":"4.4",
    //  "classGrade":"A-" }
    // Returns an empty array if no classes match.
    getCoursesByFilters: function(parameters){
      var courses=[];
      var regex = new RegExp(/^(?=.*[A-Z0-9])/i);
      for(var key in parameters){
        if(!regex.test(key) || regex.test(parameters[key])) return courses;
      }
      courses=Classes.find(parameters).fetch();
      return courses;
    },

  // Update the local database when Cornell Course API adds data for the
  // upcoming semester. Will add new classes if they don't already exist,
  // and update the semesters offered for classes that do.
  // Then, call a second function to link crosslisted courses, so reviews
  // from all "names" of a class are visible under each course.
  // Should be called by an admin via the admin page once a semester.
  // TODO uncomment
  // addNewSemester: function (initiate) {
  //   // ensure code is running on the server, not client
  //   if (initiate && Meteor.isServer) {
  //     console.log("updating new semester");
  //     const val = addAllCourses(findCurrSemester());
  //     if (val) {
  //       return addCrossList();
  //     } else {
  //       console.log("fail");
  //       return 0;
  //     }
  //   }
  // },

  // Update the local database by linking crosslisted courses, so reviews
  // from all "names" of a class are visible under each course.
  // Should be called by an admin via the admin page ONLY ONCE
  // during database initialization, after calling addAll below.
  // addCrossList: function(initiate) {
  //     // ensure the code is running on the server, not the client
  //     if (initiate && Meteor.isServer) {
  //         console.log("adding cross-listed classes");
  //         return addCrossList();
  //     }
  // },

  // Update the local database with all courses from the Cornell Class Roster.
  // Then, call a second function to link crosslisted courses, so reviews
  // from all "names" of a class are visible under each course.
  // Should be called by an admin via the admin page ONLY ONCE during database
  // initialization.
  // TODO uncomment
  // addAll: function (initiate) {
  //   // ensure code is running on the server, not the client
  //   if (initiate && Meteor.isServer) {
  //     Classes.remove({});
  //     Subjects.remove({});
  //     const val = addAllCourses(findAllSemesters());
  //     if (val) {
  //       return addCrossList();
  //     } else {
  //       console.log("fail");
  //       return 0;
  //     }
  //   }
  // },

  /* Update the database so we have the professors information.
  This calls updateProfessors in dbInit
  NOTE: We are temporarily not updating any professors for classes inspect
  'SU14','SU15','SU16','SU17','SU18', 'FA18', 'WI18'*/
  // TODO uncomment
  // setProfessors: function (initiate) {
  //   if (initiate && Meteor.isServer) {
  //     var semesters = findAllSemesters();
  //     // var toRemove = ['SU14','SU15','SU16','SU17','WI14','WI15','WI16','WI17','SU18', 'FA18', 'WI18']
  //     var toRemove = ['SU18', 'FA18', 'WI18']
  //     toRemove.forEach(function (sem) {
  //       var index = semesters.indexOf(sem);
  //       if (index > -1) {
  //         semesters.splice(index, 1);
  //       }
  //     })
  //     console.log("These are the semesters");
  //     console.log(semesters);
  //     const val = updateProfessors(semesters);
  //     if (val) {
  //       return val;
  //     } else {
  //       console.log("fail at setProfessors in method.js");
  //       return 0;
  //     }
  //   }
  // },

  /* Initializes the classProfessors field in the Classes collection to an empty array so that
  we have a uniform empty array to fill with updateProfessors
  This calls the resetProfessorArray in dbInit
  NOTE: We are temporarily not updating any professors for classes inspect
  'SU18', 'FA18', 'WI18'*/
  // TODO uncomment
  // resetProfessors: function (initiate) {
  //   if (initiate && Meteor.isServer) {
  //     var semesters = findAllSemesters();
  //     var toRemove = ['SU18', 'FA18', 'WI18']
  //     toRemove.forEach(function (sem) {
  //       var index = semesters.indexOf(sem);
  //       if (index > -1) {
  //         semesters.splice(index, 1);
  //       }
  //     })
  //     console.log("These are the semesters");
  //     console.log(semesters);
  //     const val = resetProfessorArray(semesters);
  //     if (val) {
  //       return val;
  //     } else {
  //       console.log("fail at resetProfessors in method.js");
  //       return 0;
  //     }
  //   }
  // },

  //Get a user with this netId from the Users collection in the local database
  getUserByNetId: function (netId) {
    var regex = new RegExp(/^(?=.*[A-Z0-9])/i);
    if (regex.test(netId)) {
      var user = Students.find({ netId: netId }).fetch()[0];
      return user;
    }
    return null;
  },
  
  //Returns true if user matching "netId" is an admin
  userIsAdmin: function (netId) {
    var regex = new RegExp(/^(?=.*[A-Z0-9])/i);
    user = Meteor.call('getUserByNetId', netId)
    if (user){
      return user.privilege == "admin";
    }
    return false;
  },

  // Get a course with this course_id from the Classes collection in the local database.
  getCourseById: function (courseId) {
    // check: make sure course id is valid and non-malicious
    var regex = new RegExp(/^(?=.*[A-Z0-9])/i);
    if (regex.test(courseId)) {
      var c = Classes.find({ _id: courseId }).fetch()[0];
      return c;
    }
    return null
  },

  // Get a course with this course number and subject from the Classes collection in the local database.
  getCourseByInfo: function (number, subject) {
    // check: make sure number and subject are valid, non-malicious strings
    const numberRegex = new RegExp(/^(?=.*[0-9])/i);
    const subjectRegex = new RegExp(/^(?=.*[A-Z])/i);
    if (numberRegex.test(number) && subjectRegex.test(subject)) {
      return Classes.find({ classSub: subject, classNum: number }).fetch()[0];
    }
    else {
      return null;
    }
  },

  // Flag a review - mark it as reported and make it invisible to non-admin users.
  // To be called by a non-admin user from a specific review.
  reportReview: function (review) {
    // check: make sure review id is valid and non-malicious
    var regex = new RegExp(/^(?=.*[A-Z0-9])/i)
    if (regex.test(review._id)) {
      Reviews.update({ _id: review._id }, { $set: { visible: 0, reported: 1 } });
      return 1;
    } else {
      return 0;
    }
  },

  // Un-flag a review, making it visible to everyone and "unreported"
  // To be called by an admin via the admin interface.
  undoReportReview: function (review) {
    // check: make sure review id is valid and non-malicious
    var regex = new RegExp(/^(?=.*[A-Z0-9])/i)
    if (regex.test(review._id)) {
      Reviews.update({ _id: review._id }, { $set: { visible: 1, reported: 0 } });
      return 1;
    } else {
      return 0;
    }
  },

  // Get a list the most popular courses from the Classes collection (objects)
  // popular classes -> most reviewed.
  topSubjects: function () {
    // using the add-on library meteorhacks:aggregate, define pipeline aggregate functions
    // to run complex queries
    var pipeline = [
      //consider only visible reviews
      { $match: { visible: 1 } },
      //group by class and get count of reviews
      { $group: { _id: '$class', reviewCount: { $sum: 1 } } }
      //sort by decending count
      // {$sort: {"reviewCount": -1}},
      // {$limit: 10}
    ];
    // reviewedSubjects is a dictionary-like object of subjects (key) and
    // number of reviews (value) associated with that subject
    var reviewedSubjects = new defaultDict();
    //run the query and return the class name and number of reviews written to it
    mostReviews = Reviews.aggregate(pipeline).map(function (course) {
      // classObject is the Class object associated with course._id
      var classObject = Classes.find({ _id: course._id }).fetch()[0];
      // classSubject is the string of the full subject of classObject
      var classSubject = Subjects.find({ subShort: classObject.classSub }).fetch()[0].subFull;
      // Adds the number of reviews to the ongoing count of reviews per subject
      reviewedSubjects[classSubject] = reviewedSubjects.get(classSubject) + course.reviewCount;
      return classObject;
    });
    // Creates a map of subjects (key) and total number of reviews (value)
    var subjectsMap = new Map(Object.entries(reviewedSubjects));
    subjectsMap.delete("get");
    var subjectsAndReviewCountArray = Array.from(subjectsMap);
    subjectsAndReviewCountArray = subjectsAndReviewCountArray.sort(function (a, b) {
      //Sorts array by number of reviews each topic has
      return a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0;
    });

    // Returns the top 15 most reviewed classes
    return subjectsAndReviewCountArray.slice(0, 15)
  },

  // Print on the server side for API testing. Should print in logs if
  // called by the API (in the Auth component).
  printOnServer: function (text) {
    console.log(text);
  },


  //TODO: invalidate this user's token by deleting it
  removeToken: function (userId) {

  },



  // Validate admin password.
  // Upon success, return 1, else return 0.
  vailidateAdmin: function (pass) {
    // check: make sure review id is valid and non-malicious
    var regex = new RegExp(/^(?=.*[A-Z0-9])/i)
    if (regex.test(pass)) {
      if (Validation.find({}).fetch()[0].adminPass == pass) {
        return 1;
      }
      return 0;
    } else {
      return 0;
    }
  },

  /**
   * Returns true if [netid] matches the netid in the email of the JSON
   * web token. False otherwise.
   * This method authenticates the user token through the Google API.
   * @param token: google auth token
   * @param netid: netid to verify
   * @requires that you have a handleVerifyError, like as follows:
   * verify(token, function(){//do whatever}).catch(function(error){
   * handleVerifyError(error, res);
   */
  verify: async function (token, netid) {
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: "836283700372-msku5vqaolmgvh3q1nvcqm3d6cgiu0v1.apps.googleusercontent.com",  // Specify the CLIENT_ID of the app that accesses the backend
        // Or, if multiple clients access the backend:
        //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
      });
      // console.log(ticket);
      const payload = ticket.getPayload();
      //The REST API uses payloads to pass and return data structures too large to be handled as parameters
      //The term 'payload' is used to distinguish it as the 'interesting' 
      //information in a chunk of data or similar from the overhead to support it
      const { email } = payload;

      //parse out the netid from email to verify it is the same as the netid 
      //passed in (similar to research connect)
      const emailBeforeAt = email.replace((`@${payload.hd}`), '');
      // console.log(emailBeforeAt);
      // console.log(netid);
      const valid_email = emailBeforeAt == netid;
      
      return valid_email;

    } catch (e) {
      console.log(e);
      return false;
    }
    
  },
  /**
   * Used in the .catch when verify is used, handles whatever should be done
   * @param errorObj (required) the error that is returned from the .catch
   * @param res the response object
   * @return {boolean} true if their token is too old, false if some other error
   * @requires that you have the verify function, like as follows:
   * verify(token, function(){//do whatever}).catch(function(error){
   *        handleVerifyError(error, res);
   * }
   */
  handleVerifyError: function (errorObj, res) {
    if (errorObj && errorObj.toString()) {
      if (errorObj.toString().indexOf('used too late') !== -1) {
        res.status(409).send('Token used too late');
        return true;
      }

      res.status(409).send('Invalid token');
      return true;
    }
    return false;
  }

});

// Recreation of Python's defaultdict to be used in topSubjects method
function defaultDict() {
  this.get = function (key) {
    if (this.hasOwnProperty(key)) {
      return this[key];
    }
    else {
      return 0;
    }
  }
};

// helper function
function isJSON(str) {
  try {
    return (JSON.parse(str) && !!str);
  } catch (e) {
    return false;
  }
}