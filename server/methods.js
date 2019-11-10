/* eslint-disable meteor/audit-argument-checks */
import { Mongo } from 'meteor/mongo';
import { HTTP } from 'meteor/http';
import { check, Match } from 'meteor/check';
import { addAllCourses, findCurrSemester, findAllSemesters, addCrossList, updateProfessors, resetProfessorArray } from './dbInit.js';
import { Classes, Students, Subjects, Reviews, Validation } from '../imports/api/dbDefs.js';

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client("836283700372-msku5vqaolmgvh3q1nvcqm3d6cgiu0v1.apps.googleusercontent.com");
/* # Meteor Methods
   # Client-side code in meteor is not allowed direct access to the local database
   # (this makes it easier to keep the backend secure from outside users).
   # Instead, the Client interacts with the database through the functions definied below,
   # which can be initiated by the Client but run on the Server.
*/

// Helper to check if a string is a subject code
const isSubShorthand = (sub) => {
  const subCheck = Subjects.find({subShort: sub}).fetch()
  return subCheck.length > 0;
}

// helper to format search within a subject
const searchWithinSubject = (sub, remainder) => {
  return Classes.find(
    { 'classSub':  sub, 'classFull': { '$regex' : `.*${remainder}.*`, '$options' : '-i' }},
    {sort: {classFull: 1}, limit: 200},
    {reactive: false}).fetch();
}

Meteor.methods({
  // insert a new review into the reviews collection.
  // Upon success returns 1, else returns 0.
  insert: function (token, review, classId) {
    // check: only insert if all form fields are filled in
    if (token == undefined) {
      console.log("Error: Token was undefined in insert");
      return 0; // Token was undefined
    }
    const ticket = Meteor.call('getVerificationTicket', token);
    // console.log("ticket");
    // console.log(ticket);
    Meteor.call('insertUser', ticket);
    if (ticket.hd === "cornell.edu"){
      if (review.text !== null && review.diff !== null && review.rating !== null && review.workload !== null && review.professors !== null && classId !== undefined && classId !== null) {
        const fullReview = {
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
          console.log("Success: Submitted review");
          return 1; //success
        } catch (error) {
          console.log(error)
          return 0; //fail
        }
      } else {
        console.log("Error: Some review values are null");
        return 0; //fail
      }
    } else {
      console.log("Error: non-Cornell email attempted to insert review");
      return 0; //fail
    }

  },

  //Inserts a new user into the Users collection.
  //Upon success returns 1, else returns 0
  insertUser: function (googleObject) {
    //Check user object has all required fields
    if (googleObject.email.replace("@cornell.edu", "") != null) {
      const newUser = {
        // Check to see if Google returns first and last name
        // If not, insert empty string to database
        firstName: googleObject.given_name ? googleObject.given_name : "",
        lastName: googleObject.family_name ? googleObject.family_name : "",
        netId: googleObject.email.replace("@cornell.edu", ""),
        affiliation: null,
        token: null,
        privilege: "regular"
      };

      const user = Meteor.call('getUserByNetId', googleObject.email.replace("@cornell.edu", ""));
      if (user == null) {
        try {
          //check(newUser, Users);
          Students.insert(newUser);
          return 1; //success
        } catch (error) {
          console.log("Error: In inserting Student");
          console.log(error);
          return 0; //fail
        }
      }
      return 1; //No need to add user again


    }
    else {
      //error handling
      console.log("Some user values are null in insertUser");
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
  makeVisible: function (review, token) {
    // check: make sure review id is valid and non-malicious
    const userIsAdmin = Meteor.call('tokenIsAdmin', token);
    const regex = new RegExp(/^(?=.*[A-Z0-9])/i);
    if (regex.test(review._id) && userIsAdmin) {
      Reviews.update(review._id, { $set: { visible: 1 } });
      return 1;
    } else {
      return 0;
    }
  },

  // Delete this review from the local database.
  // Upon succcess, return 1, else 0.
  removeReview: function (review, token) {
    // check: make sure review id is valid and non-malicious
    const userIsAdmin = Meteor.call('tokenIsAdmin', token);
    const regex = new RegExp(/^(?=.*[A-Z0-9])/i);
    if (regex.test(review._id) && userIsAdmin) {
      Reviews.remove({ _id: review._id });
      return 1;
    } else {
      return 0;
    }
  },

  // Update the local database when Cornell Course API adds data for the
  // upcoming semester. Will add new classes if they don't already exist,
  // and update the semesters offered for classes that do.
  // Then, call a second function to link crosslisted courses, so reviews
  // from all "names" of a class are visible under each course.
  // Should be called by an admin via the admin page once a semester.
  // TODO uncomment
  // addNewSemester: function (initiate, token) {
  // const userIsAdmin = Meteor.call('tokenIsAdmin', token);
  //   // ensure code is running on the server, not client
  //   if (initiate && Meteor.isServer && userIsAdmin) {
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
  // addAll: function (initiate, token) {
  //  const userIsAdmin=Meteor.call('tokenIsAdmin', token);
  //   // ensure code is running on the server, not the client
  //   if (initiate && Meteor.isServer && userIsAdmin) {
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
  setProfessors: function (initiate, token) {
  const userIsAdmin = Meteor.call('tokenIsAdmin', token);
    if (initiate && Meteor.isServer && userIsAdmin) {
      var semesters = findAllSemesters();
      // var toRemove = ['SU14','SU15','SU16','SU17','WI14','WI15','WI16','WI17','SU18', 'FA18', 'WI18']
      var toRemove = ['SU18', 'FA18', 'WI18']
      toRemove.forEach(function (sem) {
        var index = semesters.indexOf(sem);
        if (index > -1) {
          semesters.splice(index, 1);
        }
      })
      console.log("These are the semesters");
      console.log(semesters);
      const val = updateProfessors(semesters);
      if (val) {
        return val;
      } else {
        console.log("fail at setProfessors in method.js");
        return 0;
      }
    }
  },

  /* Initializes the classProfessors field in the Classes collection to an empty array so that
  we have a uniform empty array to fill with updateProfessors
  This calls the resetProfessorArray in dbInit
  NOTE: We are temporarily not updating any professors for classes inspect
  'SU18', 'FA18', 'WI18'*/
  // TODO uncomment
  // resetProfessors: function (initiate, token) {
  // const userIsAdmin = Meteor.call('tokenIsAdmin', token);
  //   if (initiate && Meteor.isServer && userIsAdmin) {
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
    // console.log("This is user in getUserByNetId");
    // console.log(netId);
    const regex = new RegExp(/^(?=.*[A-Z0-9])/i);
    if (regex.test(netId)) {
      const user = Students.find({ netId: netId }).fetch()[0];
      // console.log("This is user object");
      // console.log(user);
      return user;
    }
    return null;
  },

  //Returns true if user matching "netId" is an admin
  tokenIsAdmin: function (token) {
    // console.log("This is token in tokenIsAdmin");
    // console.log(token);
    if (token != undefined) {
      const ticket = Meteor.call('getVerificationTicket', token);
      // console.log(ticket);
      const user = Meteor.call('getUserByNetId', ticket.email.replace("@cornell.edu", ""));
      if (user) {
        return user.privilege === "admin";
      }
    }
    console.log("Token is undefined at tokenIsAdmin")
    return false;
  },

  getClassesByQuery: function (searchString) {
    if (searchString !== undefined && searchString !== "") {
      // check if first digit is a number. Catches searchs like "1100"
      // if so, search only through the course numbers and return classes ordered by full name
      const indexFirstDigit = searchString.search(/\d/)
      if (indexFirstDigit == 0) {
        // console.log("only numbers")
        return Classes.find(
          {classNum : { '$regex' : `.*${searchString}.*`, '$options' : '-i' }}, 
          {sort: {classFull: 1}, limit: 200}, 
          {reactive: false}).fetch();
      }

      // check if searchString is a subject, if so return only classes with this subject. Catches searches like "CS"
      if (isSubShorthand(searchString)) {
        return Classes.find(
          { 'classSub':  searchString},
          {sort: {classFull: 1}, limit: 200},  
          {reactive: false}).fetch();
      }
      // check if text before space is subject, if so search only classes with this subject.
      // Speeds up searches like "CS 1110"
      const indexFirstSpace = searchString.search(" ")
      if (indexFirstSpace != -1) {
        const strBeforeSpace = searchString.substring(0, indexFirstSpace)
        const strAfterSpace = searchString.substring(indexFirstSpace + 1)
        if (isSubShorthand(strBeforeSpace)) {
          // console.log("matches subject with space: " + strBeforeSpace)
          return searchWithinSubject(strBeforeSpace, strAfterSpace)
        }
      }
  
      // check if text is subject followed by course number (no space)
      // if so search only classes with this subject.
      // Speeds up searches like "CS1110"
      if (indexFirstDigit != -1) {
        const strBeforeDigit = searchString.substring(0, indexFirstDigit)
        const strAfterDigit = searchString.substring(indexFirstDigit)
        if (isSubShorthand(strBeforeDigit)) {
          // console.log("matches subject with digit: " + String(strBeforeDigit))
          return searchWithinSubject(strBeforeDigit, strAfterDigit)
        }
      }
  
      //last resort, search everything 
      // console.log("nothing matches");
      return Classes.find(
        { 'classFull': { '$regex' : `.*${searchString}.*`, '$options' : '-i' }},
        {sort: {classFull: 1}, limit: 200}, 
        {reactive: false}
      ).fetch();
    } else {
      //console.log("no search");
      return Classes.find({}, {sort: {classFull: 1}, limit: 200}, {reactive: false}).fetch();
    }
  },


  // Get a course with this course_id from the Classes collection in the local database.
  getCourseById: function (courseId) {
    // check: make sure course id is valid and non-malicious
    const regex = new RegExp(/^(?=.*[A-Z0-9])/i);
    if (regex.test(courseId)) {
      const c = Classes.find({ _id: courseId }).fetch()[0];
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
    const regex = new RegExp(/^(?=.*[A-Z0-9])/i)
    if (regex.test(review._id)) {
      Reviews.update({ _id: review._id }, { $set: { visible: 0, reported: 1 } });
      return 1;
    } else {
      return 0;
    }
  },

  // Un-flag a review, making it visible to everyone and "unreported"
  // To be called by an admin via the admin interface.
  undoReportReview: function (review, token) {
    const userIsAdmin = Meteor.call('tokenIsAdmin', token);
    // check: make sure review id is valid and non-malicious
    const regex = new RegExp(/^(?=.*[A-Z0-9])/i)
    if (regex.test(review._id) && userIsAdmin) {
      Reviews.update({ _id: review._id }, { $set: { visible: 1, reported: 0 } });
      return 1;
    } else {
      return 0;
    }
  },

  //get all reviews by professor
  getReviewsByProfessor: function (professor) {
    const regex = new RegExp(/^(?=.*[A-Z])/i)
    if (regex.test(professor)) {
      return Reviews.find({ professors: { $elemMatch: { $eq: professor } } }).fetch();
    } else {
      return null;
    }
  },

  //get all classes by professor
  getClassesByProfessor: function (professor) {
    const regex = new RegExp(/^(?=.*[A-Z])/i)
    if (regex.test(professor)) {
      return Classes.find({ classProfessors: { $elemMatch: { $eq: professor } } }).fetch();
    } else {
      return null;
    }
  },

  // Get a list the most popular courses from the Classes collection (objects)
  // popular classes -> most reviewed.
  topSubjects: function () {
    // using the add-on library meteorhacks:aggregate, define pipeline aggregate functions
    // to run complex queries
    const pipeline = [
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
    const reviewedSubjects = new defaultDict();
    //run the query and return the class name and number of reviews written to it
    const mostReviews = Reviews.aggregate(pipeline).map(function (course) {
      // classObject is the Class object associated with course._id
      const classObject = Classes.find({ _id: course._id }).fetch()[0];
      // classSubject is the string of the full subject of classObject
      const classSubject = Subjects.find({ subShort: classObject.classSub }).fetch()[0].subFull;
      // Adds the number of reviews to the ongoing count of reviews per subject
      reviewedSubjects[classSubject] = reviewedSubjects.get(classSubject) + course.reviewCount;
      return classObject;
    });
    // Creates a map of subjects (key) and total number of reviews (value)
    const subjectsMap = new Map(Object.entries(reviewedSubjects));
    subjectsMap.delete("get");
    let subjectsAndReviewCountArray = Array.from(subjectsMap);
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
    const regex = new RegExp(/^(?=.*[A-Z0-9])/i)
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
  getVerificationTicket: async function (token) {
    try {
      if (token == undefined) {
        console.log("Token was undefined in getVerificationTicket")
        return 0; // Token was undefined
      }
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: "836283700372-msku5vqaolmgvh3q1nvcqm3d6cgiu0v1.apps.googleusercontent.com",  // Specify the CLIENT_ID of the app that accesses the backend
        // Or, if multiple clients access the backend:
        //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
      });
      return ticket.getPayload();
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
      console.log("Error: at getVerificationTicket");
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
}

// helper function
// function isJSON(str) {
//   try {
//     return (JSON.parse(str) && !!str);
//   } catch (e) {
//     return false;
//   }
// }