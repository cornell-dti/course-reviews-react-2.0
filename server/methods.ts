import { getMetricValues, getCrossListOR } from 'common/CourseCard';
import { OAuth2Client } from 'google-auth-library';
import { TokenPayload } from 'google-auth-library/build/src/auth/loginticket';
import shortid from 'shortid';
import { includesProfanity } from "common/profanity";
import { Classes, Students, Subjects, Reviews, Validation, StudentDocument, Professors } from './dbDefs';
import { Meteor } from './shim';
import { findAllSemesters, updateProfessors, resetProfessorArray } from './dbInit';

const client = new OAuth2Client("836283700372-msku5vqaolmgvh3q1nvcqm3d6cgiu0v1.apps.googleusercontent.com");
export const ADMIN_DISABLED_VALUE = "1";

// Helper to check if a string is a subject code
// exposed for testing
export const isSubShorthand = async (sub: string) => {
  const subCheck = await Subjects.find({ subShort: sub }).exec();
  return subCheck.length > 0;
};

// helper to format search within a subject
const searchWithinSubject = (sub: string, remainder: string) => Classes.find(
  { classSub: sub, classFull: { $regex: `.*${remainder}.*`, $options: '-i' } },
  {},
  { sort: { classFull: 1 }, limit: 200, reactive: false },
).exec();

// uses levenshtein algorithm to return the minimum edit distance between two strings
// exposed for testing
export const editDistance = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // increment each column in the first row
  let j;
  for (j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
          Math.min(matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1)); // deletion
      }
    }
  }

  return matrix[b.length][a.length];
};

// a wrapper for a comparator function to be used to sort courses by comparing their edit distance with the query
const courseSort = (query) => (a, b) => {
  const aCourseStr = `${a.classSub} ${a.classNum}`;
  const bCourseStr = `${b.classSub} ${b.classNum}`;
  const queryLen = query.length;
  return editDistance(query.toLowerCase(), aCourseStr.slice(0, queryLen))
    - editDistance(query.toLowerCase(), bCourseStr.slice(0, queryLen));
};

/* Meteor Methods
* Client-side code in meteor is not allowed direct access to the local database
* (this makes it easier to keep the backend secure from outside users).
* Instead, the Client interacts with the database through the functions definied below,
* which can be initiated by the Client but run on the Server
*
* We will replace these with express explicitly in the future
*/
Meteor.methods({
  /**
   * Insert a new review into the database
   *
   * Returns 0 if there was an error
   * Returns 1 on a success
   */
  async insert(token, review, classId) {
    try {
      const adminDisabled = process.env.ADMIN_DISABLED === ADMIN_DISABLED_VALUE;
      if (!adminDisabled && token === undefined) {
        // eslint-disable-next-line no-console
        console.log("Error: Token was undefined in insert");
        return { resCode: 0, errMsg: "Error: Token was undefined in insert" };
      }

      let ticket;
      if (!adminDisabled) {
        ticket = await Meteor.call<TokenPayload | null>("getVerificationTicket", token);
        if (!ticket) return { resCode: 0, errMsg: "Missing verification ticket" };
      }

      if (adminDisabled || ticket.hd === "cornell.edu") {
        // insert the user into the collection if not already present
        if (!adminDisabled) {
          await Meteor.call("insertUser", ticket);
        }

        if (review.text !== null && includesProfanity(review.text)) {
          // eslint-disable-next-line no-console
          console.log("profanity detected in review.");
          return { resCode: 0, errMsg: "Your review contains profanity, please edit your response." };
        }

        if (review.text !== null && review.diff !== null && review.rating !== null
          && review.workload !== null && review.professors !== null && classId !== undefined
          && classId !== null) {
          try {
            // Attempt to insert the review
            const fullReview = new Reviews({
              _id: shortid.generate(),
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
              isCovid: review.isCovid,
            });


            await fullReview.save();
            return { resCode: 1, errMsg: "" };
          } catch (error) {
            // eslint-disable-next-line no-console
            console.log(error);
            return { resCode: 0, errMsg: "Unexpected error when adding review" };
          }
        } else {
          // eslint-disable-next-line no-console
          console.log("Error: Some review values are null");
          return { resCode: 0, errMsg: "Error: Some review values are null" };
        }
      } else {
        // eslint-disable-next-line no-console
        console.log("Error: non-Cornell email attempted to insert review");
        return { resCode: 0, errMsg: "Error: non-Cornell email attempted to insert review" };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'insert' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return { resCode: 0, errMsg: "Error: at 'insert' method" };
    }
  },

  /**
   * Inserts a new user into the database, if the user was not already present
   *
   * Returns 1 if the user was added to the database, or was already present
   * Returns 0 if there was an error
   */
  async insertUser(googleObject) {
    try {
      // Check user object has all required fields
      if (googleObject.email.replace("@cornell.edu", "") !== null) {
        const user = await Meteor.call<StudentDocument | null>("getUserByNetId", googleObject.email.replace("@cornell.edu", ""));
        if (user === null) {
          const newUser = new Students({
            _id: shortid.generate(),
            // Check to see if Google returns first and last name
            // If not, insert empty string to database
            firstName: googleObject.given_name ? googleObject.given_name : "",
            lastName: googleObject.family_name ? googleObject.family_name : "",
            netId: googleObject.email.replace("@cornell.edu", ""),
            affiliation: null,
            token: null,
            privilege: "regular",
          });

          await newUser.save();
        }
        return 1;
      }

      console.log("Error: Some user values are null in insertUser");
      return 0;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'insertUser' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return 0;
    }
  },
  /**
   * Increment the number of likes a review has gotten by 1.
   *
   * Returns 1 on success
   * Returns 0 on error
   */
  async incrementLike(id) {
    try {
      const review = await Reviews.findOne({ _id: id }).exec();
      if (review.likes === undefined) {
        await Reviews.updateOne({ _id: id }, { $set: { likes: 1 } }).exec();
      } else {
        await Reviews.updateOne({ _id: id }, { $set: { likes: review.likes + 1 } }).exec();
      }
      return 1;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'incrementLike' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return 0;
    }
  },

  /**
   * Decrement the number of likes a review has gotten by 1.
   *
   * Returns 1 on success
   * Returns 0 on error
   */
  async decrementLike(id) {
    try {
      const review = await Reviews.findOne({ _id: id }).exec();
      if (review.likes === undefined) {
        await Reviews.updateOne({ _id: id }, { $set: { likes: 0 } }).exec();
      } else {
        await Reviews.updateOne({ _id: id }, { $set: { likes: review.likes - 1 } }).exec();
      }
      return 1;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'decrementLike' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return 0;
    }
  },

  // Make this review visible to everyone (ex: un-report or approve a review)
  // Upon succcess, return 1, else 0.
  async makeVisible(review, token) {
    try {
      // check: make sure review id is valid and non-malicious
      const userIsAdmin = await Meteor.call("tokenIsAdmin", token);
      const regex = new RegExp(/^(?=.*[A-Z0-9])/i);
      if (regex.test(review._id) && userIsAdmin) {
        await Reviews.updateOne({ _id: review._id }, { $set: { visible: 1 } });
        await Meteor.call("updateCourseMetrics", review.class, token);
        return 1;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'makeVisible' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return 0;
    }
  },

  // Delete this review from the local database.
  // Upon succcess, return 1, else 0.
  async removeReview(review, token) {
    try {
      // check: make sure review id is valid and non-malicious
      const userIsAdmin = await Meteor.call("tokenIsAdmin", token);
      const regex = new RegExp(/^(?=.*[A-Z0-9])/i);
      if (regex.test(review._id) && userIsAdmin) {
        await Reviews.remove({ _id: review._id });
        await Meteor.call("updateCourseMetrics", review.class, token);
        return 1;
      }
      return 0;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'removeReview' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return 0;
    }
  },

  // This updates the metrics for an individual class given its Mongo-generated id.
  // Returns 1 if successful, 0 otherwise.
  async updateCourseMetrics(courseId, token) {
    try {
      const userIsAdmin = await Meteor.call("tokenIsAdmin", token);
      if (userIsAdmin) {
        const course = await Meteor.call("getCourseById", courseId);
        if (course) {
          const crossListOR = getCrossListOR(course);
          const reviews = await Reviews.find({ visible: 1, reported: 0, $or: crossListOR }, {}, { sort: { date: -1 }, limit: 700 }).exec();
          const state = getMetricValues(reviews);

          await Classes.updateOne({ _id: courseId },
            {
              $set: {
                // If no data is available, getMetricValues returns "-" for metric
                classDifficulty: (state.diff !== "-" && !isNaN(state.diff) ? Number(state.diff) : null),
                classRating: (state.rating !== "-" && !isNaN(state.rating) ? Number(state.rating) : null),
                classWorkload: (state.workload !== "-" && !isNaN(state.workload) ? Number(state.workload) : null),
              },
            });
          return 1;
        }
        return 0;
      }
      return 0;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'updateCourseMetrics' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return 0;
    }
  },
  // Used to update the review metrics for all courses
  // in the database.
  async updateMetricsForAllCourses(token) {
    try {
      const userIsAdmin = await Meteor.call("tokenIsAdmin", token);
      if (userIsAdmin) {
        console.log("Starting update for metrics");
        const courses = await Classes.find().exec();
        await Promise.all(courses.map(async (course) => {
          await Meteor.call("updateCourseMetrics", course._id);
        }));
        console.log("Updated metrics for all courses");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'updateMetricsForAllCourses' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return 0;
    }
  },

  // Returns courses with the given parameters.
  // Takes in a dictionary object of field names
  // and the desired value, i.e.
  // {classSub: "PHIL"} or
  // {classDifficulty: 3.0}
  // Returns an empty array if no classes match.
  // NOTE/TODO: I don't think this actually works as intended
  // let's refactor in future - Julian
  async getCoursesByFilters(parameters) {
    try {
      let courses = [];
      const regex = new RegExp(/^(?=.*[A-Z0-9])/i);
      // TODO: add regular expression for floating point numbers
      for (const key in parameters) {
        if (!regex.test(key)) return courses;
      }
      courses = await Classes.find(parameters).exec();
      return courses;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'getCoursesByFilters' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return null;
    }
  },

  // Returns courses with the given parameters.
  // Takes in a major abbreviation
  // e.g. CS, INFO, PHIL
  // Returns an empty array if no classes match.
  async getCoursesByMajor(major) {
    try {
      let courses = [];
      const regex = new RegExp(/^(?=.*[A-Z0-9])/i);
      if (regex.test(major)) {
        courses = await Classes.find({ classSub: major }).exec();
      }
      return courses;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'getCoursesByMajor' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return null;
    }
  },

  // Returns courses with the given parameters.
  // Takes in a professor full name
  // e.g. David Gries, Michael George
  // Returns an empty array if no classes match.
  async getCoursesByProfessor(professor) {
    try {
      let courses = [];
      const regex = new RegExp(/^(?=.*[A-Z0-9])/i);
      if (regex.test(professor)) {
        courses = await Classes.find({ classProfessors: professor }).exec();
      }
      return courses;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'getCoursesByProfessor' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return null;
    }
  },

  // Update the local database when Cornell Course API adds data for the
  // upcoming semester. Will add new classes if they don't already exist,
  // and update the semesters offered for classes that do.
  // Then, call a second function to link crosslisted courses, so reviews
  // from all "names" of a class are visible under each course.
  // Should be called by an admin via the admin page once a semester.
  // TODO uncomment
  // async addNewSemester(initiate, token) {
  // const userIsAdmin = await Meteor.call("tokenIsAdmin", token);
  //   // ensure code is running on the server, not client
  //   if (initiate && Meteor.isServer && userIsAdmin) {
  //     console.log("updating new semester");
  //     const val = await addAllCourses(await findCurrSemester());
  //     if (val) {
  //       return await addCrossList();
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
  // async addCrossList(initiate) {
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
  // async addAll(initiate, token) {
  //  const userIsAdmin = await Meteor.call("tokenIsAdmin", token);
  //   // ensure code is running on the server, not the client
  //   if (initiate && Meteor.isServer && userIsAdmin) {
  //     await Classes.remove({}).exec();
  //     await Subjects.remove({}).exec();
  //     const val = await addAllCourses(await findAllSemesters());
  //     if (val) {
  //       return await addCrossList();
  //     } else {
  //       console.log("fail");
  //       return 0;
  //     }
  //   }
  // },

  /* Update the database so we have the professors information.
  This calls updateProfessors in dbInit */
  async setProfessors(initiate, token) {
    try {
      const userIsAdmin = await Meteor.call("tokenIsAdmin", token);
      if (initiate && userIsAdmin) {
        const semesters = findAllSemesters();
        console.log("These are the semesters");
        console.log(semesters);
        const val = updateProfessors(semesters);
        if (val) {
          return val;
        }
        console.log("fail at setProfessors in method.js");
        return 0;
      }
      return 0;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'setProfessors' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return 0;
    }
  },

  /* Initializes the classProfessors field in the Classes collection to an empty array so that
  we have a uniform empty array to fill with updateProfessors
  This calls the resetProfessorArray in dbInit */
  async resetProfessors(initiate, token) {
    try {
      const userIsAdmin = await Meteor.call("tokenIsAdmin", token);
      if (initiate && userIsAdmin) {
        const semesters = findAllSemesters();
        console.log("These are the semesters");
        console.log(semesters);
        const val = resetProfessorArray(semesters);
        if (val) {
          return val;
        }
        console.log("fail at resetProfessors in method.js");
        return 0;
      }
      return 0;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'resetProfessors' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return 0;
    }
  },

  // Get a user with this netId from the Users collection in the local database
  async getUserByNetId(netId: string) {
    try {
      const regex = new RegExp(/^(?=.*[A-Z0-9])/i);
      if (regex.test(netId)) {
        return await Students.findOne({ netId }).exec();
      }
      return null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'getUserByNetId' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return null;
    }
  },

  async loginDisabled() {
    return process.env.ADMIN_DISABLED === ADMIN_DISABLED_VALUE;
  },

  // Returns true if user matching "netId" is an admin
  async tokenIsAdmin(token: string) {
    try {
      if (process.env.ADMIN_DISABLED === ADMIN_DISABLED_VALUE) {
        return true;
      }
      if (token != null) {
        const ticket = await Meteor.call<TokenPayload | null>('getVerificationTicket', token);
        if (ticket && ticket.email) {
          const user = await Meteor.call<StudentDocument | null>('getUserByNetId', ticket.email.replace('@cornell.edu', ''));
          if (user) {
            return user.privilege === 'admin';
          }
        }
      }
      return false;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'tokenIsAdmin' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return false;
    }
  },

  // Get a course with this course_id from the Classes collection in the local database.
  async getCourseById(courseId) {
    try {
      // check: make sure course id is valid and non-malicious
      const regex = new RegExp(/^(?=.*[A-Z0-9])/i);
      if (regex.test(courseId)) {
        return await Classes.findOne({ _id: courseId }).exec();
      }
      return null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'getCourseById' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return null;
    }
  },

  // Get a course with this course number and subject from the Classes collection in the local database.
  async getCourseByInfo(number: string, subject: string) {
    try {
      // check: make sure number and subject are valid, non-malicious strings
      const numberRegex = new RegExp(/^(?=.*[0-9])/i);
      const subjectRegex = new RegExp(/^(?=.*[A-Z])/i);
      if (numberRegex.test(number) && subjectRegex.test(subject)) {
        return await Classes.findOne({ classSub: subject, classNum: number }).exec();
      }

      return null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'getCourseByInfo' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return null;
    }
  },

  // Flag a review - mark it as reported and make it invisible to non-admin users.
  // To be called by a non-admin user from a specific review.
  async reportReview(review) {
    try {
      // check: make sure review id is valid and non-malicious
      const regex = new RegExp(/^(?=.*[A-Z0-9])/i);
      if (regex.test(review._id)) {
        await Reviews.updateOne({ _id: review._id }, { $set: { visible: 0, reported: 1 } });
        return 1;
      }
      return 0;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'reportReview' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return 0;
    }
  },

  // Un-flag a review, making it visible to everyone and "unreported"
  // To be called by an admin via the admin interface.
  async undoReportReview(review, token) {
    try {
      const userIsAdmin = await Meteor.call("tokenIsAdmin", token);
      // check: make sure review id is valid and non-malicious
      const regex = new RegExp(/^(?=.*[A-Z0-9])/i);
      if (regex.test(review._id) && userIsAdmin) {
        await Reviews.updateOne({ _id: review._id }, { $set: { visible: 1, reported: 0 } });
        return 1;
      }
      return 0;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'undoReportReview' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return 0;
    }
  },

  // get all reviews by professor
  async getReviewsByProfessor(professor: string) {
    try {
      const regex = new RegExp(/^(?=.*[A-Z])/i);
      if (regex.test(professor)) {
        return await Reviews.find({ professors: { $elemMatch: { $eq: professor } } }).exec();
      }
      return null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'getReviewsByProfessor' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return null;
    }
  },

  // Get list of review objects for given class from class _id
  // Accounts for cross-listed reviews
  async getReviewsByCourseId(courseId: string) {
    try {
      const regex = new RegExp(/^(?=.*[A-Z])/i);
      if (regex.test(courseId)) {
        const course = await Meteor.call("getCourseById", courseId);
        if (course) {
          const crossListOR = getCrossListOR(course);
          const reviews = await Reviews.find({ visible: 1, reported: 0, $or: crossListOR }, {}, { sort: { date: -1 }, limit: 700 }).exec();
          return reviews;
        }
        return null;
      }
      return null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'getReviewsByCourseId' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return null;
    }
  },

  // get all classes by professor
  async getClassesByProfessor(professor: string) {
    try {
      const regex = new RegExp(/^(?=.*[A-Z])/i);
      if (regex.test(professor)) {
        return Classes.find({ classProfessors: { $elemMatch: { $eq: professor } } }).exec();
      }
      return null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'getClassesByProfessor' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return null;
    }
  },

  // Get a list the most popular courses from the Classes collection (objects)
  // popular classes -> most reviewed.
  async topSubjects() {
    try {
      // using the add-on library meteorhacks:aggregate, define pipeline aggregate functions
      // to run complex queries
      const pipeline = [
        // consider only visible reviews
        { $match: { visible: 1 } },
        // group by class and get count of reviews
        { $group: { _id: '$class', reviewCount: { $sum: 1 } } },
        // sort by decending count
        // {$sort: {"reviewCount": -1}},
        // {$limit: 10}
      ];
      // reviewedSubjects is a dictionary-like object of subjects (key) and
      // number of reviews (value) associated with that subject
      const reviewedSubjects = new DefaultDict();
      // run the query and return the class name and number of reviews written to it
      const results = await Reviews.aggregate<{ reviewCount: number; _id: string }>(pipeline, () => { });

      await Promise.all(results.map(async (course) => {
        const classObject = (await Classes.find({ _id: course._id }).exec())[0];
        // classSubject is the string of the full subject of classObject
        const subjectArr = await Subjects.find({ subShort: classObject.classSub }).exec();
        if (subjectArr.length > 0) {
          const classSubject = subjectArr[0].subFull;
          // Adds the number of reviews to the ongoing count of reviews per subject
          const curVal = reviewedSubjects.get(classSubject) || 0;
          reviewedSubjects[classSubject] = curVal + course.reviewCount;
        }
      }));

      // Creates a map of subjects (key) and total number of reviews (value)
      const subjectsMap = new Map(Object.entries(reviewedSubjects).filter((x): x is [string, number] => typeof x[1] === "number"));
      let subjectsAndReviewCountArray = Array.from(subjectsMap);
      // Sorts array by number of reviews each topic has
      subjectsAndReviewCountArray = subjectsAndReviewCountArray.sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0));

      // Returns the top 15 most reviewed classes
      return subjectsAndReviewCountArray.slice(0, 15);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'topSubjects' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return null;
    }
  },

  // returns an array of objects in the form {_id: cs, total: 276}
  // represnting how many classes each dept (cs, info, coml etc...) offers
  async howManyEachClass(token: string) {
    try {
      const userIsAdmin = await Meteor.call("tokenIsAdmin", token);
      if (userIsAdmin) {
        const pipeline = [
          {
            $group: {
              _id: '$classSub',
              total: {
                $sum: 1,
              },
            },
          },
        ];
        return await Classes.aggregate(pipeline, () => { });
      }
      return null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'howManyEachClass' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return null;
    }
  },

  // returns an array of objs in the form {_id: cs 2112, total: 227}
  async howManyReviewsEachClass(token: string) {
    try {
      const userIsAdmin = await Meteor.call('tokenIsAdmin', token);
      if (userIsAdmin) {
        const pipeline = [
          {
            $group: {
              _id: '$class',
              total: {
                $sum: 1,
              },
            },
          },
        ];
        const results = await Reviews.aggregate<{ _id: string; total: number }>(pipeline, () => { });

        const ret = await Promise.all(results.map(async (data) => {
          const subNum = (await Classes.find({ _id: data._id }, { classSub: 1, classNum: 1 }).exec())[0];
          const id = `${subNum.classSub} ${subNum.classNum}`;
          return { _id: id, total: data.total };
        }));

        return ret;
      }
      return null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'howManyReviewsEachClass' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return null;
    }
  },

  // returns a count of the total reviews in the db
  async totalReviews(token: string) {
    try {
      const userIsAdmin = await Meteor.call('tokenIsAdmin', token);
      if (userIsAdmin) {
        return Reviews.find({}).count();
      }
      return -1;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'totalReviews' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return -2;
    }
  },

  // Returns an array in the form {cs: [{date1:totalNum}, {date2: totalNum}, ...],
  // math: [{date1:total}, {date2: total}, ...], ... } for the top 15 majors where
  // totalNum is the totalNum of reviews for classes in that major at date date1, date2 etc...
  async getReviewsOverTimeTop15(token: string, step, range) {
    try {
      const userIsAdmin = await Meteor.call<boolean>('tokenIsAdmin', token);
      if (userIsAdmin) {
        const top15 = await Meteor.call<[string, number][]>('topSubjects');
        // contains cs, math, gov etc...
        const retArr = [];
        await Promise.all(top15.map(async (classs) => {
          const [subject] = await Subjects.find({
            subFull: classs[0],
          }, {
            subShort: 1,
          }).exec(); // EX: computer science--> cs
          const subshort = subject.subShort;
          retArr.push(subshort);
        }));
        const arrHM = [] as any[]; // [ {"cs": {date1: totalNum}, math: {date1, totalNum} },
        // {"cs": {date2: totalNum}, math: {date2, totalNum} } ]
        for (let i = 0; i < range * 30; i += step) {
          // "data": -->this{"2017-01-01": 3, "2017-01-02": 4, ...}
          // run on reviews. gets all classes and num of reviewa for each class, in x day
          const pipeline = [{
            $match: {
              date: {
                $lte: new Date(new Date().setDate(new Date().getDate() - i)),
              },
            },
          },
          {
            $group: {
              _id: '$class',
              total: {
                $sum: 1,
              },
            },
          },
          ];
          const hashMap: any = {}; // Object {"cs": {date1: totalNum, date2: totalNum, ...}, math: {date1, totalNum} }
          // eslint-disable-next-line no-await-in-loop
          const results = await Reviews.aggregate<{ _id: string; total: number }>(pipeline, () => { });
          // eslint-disable-next-line no-await-in-loop
          await Promise.all(results.map(async (data) => { // { "_id" : "KyeJxLouwDvgY8iEu", "total" : 1 } //all in same date
            const results = await Classes.find({
              _id: data._id,
            }, {
              classSub: 1,
            }).exec();

            const sub = results[0]; // finds the class corresponding to "KyeJxLouwDvgY8iEu" ex: cs 2112
            // date of this review minus the hrs mins sec
            const timeStringYMD = new Date(new Date().setDate(new Date().getDate() - i)).toISOString().split('T')[0];
            if (retArr.includes(sub.classSub)) { // if thos review is one of the top 15 we want.
              if (hashMap[sub.classSub] == null) {
                // if not in hm then add
                hashMap[sub.classSub] = {
                  [timeStringYMD]: data.total,
                };
              } else {
                // increment totalnum
                hashMap[sub.classSub] = {
                  [timeStringYMD]: hashMap[sub.classSub][timeStringYMD] + data.total,
                };
              }
            }
            if (hashMap.total == null) {
              hashMap.total = {
                [timeStringYMD]: data.total,
              };
            } else {
              hashMap.total = {
                [timeStringYMD]: hashMap.total[timeStringYMD] + data.total,
              };
            }
          }));
          arrHM.push(hashMap);
        }

        const hm2 = {}; // {cs: [{date1:totalNum}, {date2: totalNum}, ...], math: [{date1:total}, {date2: total}, ...], ... }

        // enrty:{"cs": {date1: totalNum}, math: {date1, totalNum} }
        if (arrHM.length > 0) {
          const entry = arrHM[0];
          const keys = Object.keys(entry);

          // "cs"
          keys.forEach((key) => {
            const t = arrHM.map((a) => a[key]); // for a key EX:"cs": [{date1:totalNum},{date2:totalNum}]
            hm2[key] = t;
          });
        }

        return hm2;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'getReviewsOverTimeTop15' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return null;
    }
  },

  // Print on the server side for API testing. Should print in logs if
  // called by the API (in the Auth component).
  printOnServer(text) {
    console.log(text);
  },

  // TODO: invalidate this user's token by deleting it
  removeToken(userId) {

  },

  // Validate admin password.
  // Upon success, return 1, else return 0.
  async vailidateAdmin(pass) {
    // check: make sure review id is valid and non-malicious
    const regex = new RegExp(/^(?=.*[A-Z0-9])/i);
    if (regex.test(pass)) {
      if ((await Validation.find({}).exec())[0].adminPass === pass) {
        return 1;
      }
      return 0;
    }
    return 0;
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
  async getVerificationTicket(token?: string) {
    try {
      if (token === null) {
        console.log("Token was undefined in getVerificationTicket");
        return null; // Token was undefined
      }
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: "836283700372-msku5vqaolmgvh3q1nvcqm3d6cgiu0v1.apps.googleusercontent.com", // Specify the CLIENT_ID of the app that accesses the backend
        // Or, if multiple clients access the backend:
        // [CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
      });
      return ticket.getPayload();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Error: at 'getVerificationTicket' method");
      // eslint-disable-next-line no-console
      console.log(error);
      return null;
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
  handleVerifyError(errorObj, res) {
    if (errorObj && errorObj.toString()) {
      if (errorObj.toString().indexOf('used too late') !== -1) {
        res.status(409).send('Token used too late');
        return true;
      }

      res.status(409).send('Invalid token');
      return true;
    }
    return false;
  },

});

// Recreation of Python's defaultdict to be used in topSubjects method
class DefaultDict<T = any> {
  [key: string]: T | Function;

  get(key: string): T | null {
    const val = this[key];

    if (this.hasOwnProperty(key) && typeof val !== "function") {
      return val;
    }
    return null;
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
