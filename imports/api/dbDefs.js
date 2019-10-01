import { Mongo } from 'meteor/mongo';

/*

 Database definitions file. Defines all collections in the local database,
 with collection attributes, types, and required fields.

 Used by both the Server and Client to define local and minimongo database
 structures.

*/

/* # Classes collection.
   # Holds data about each class in the course roster.
*/
export const Classes = new Mongo.Collection('classes');
Classes.schema = new SimpleSchema({
    _id: { type: String },  // mongo-generated random id for this document
    classSub: { type: String }, // subject, like "PHIL" or "CS"
    classNum: { type: Number }, // course number, like 1110
    classTitle: { type: String }, // class title, like 'Introduction to Algorithms'
    classPrereq: { type: [String], optional: true }, // list of pre-req classes, a string of Classes _id.
    crossList: { type: [String], optional: true }, // list of classes that are crosslisted with this one, a string of Classes _id.
    classFull: { type: String }, // full class title to search by, formated as 'classSub classNum: classTitle'
    classSems: { type: [String] }, // list of semesters this class was offered, like ['FA17', 'FA16']
    classProfessors: { type: [String] }, //list of professors that have taught the course over past semesters
    classRating: {type: Number}, // the average class rating from reviews
    classWorkload: {type: Number}, // the average workload rating from reviews
    classDifficulty: {type: Number}, // the average difficulty rating from reviews
    classGrade: {type: Number} // the average grade from reviews

});

/* # Users collection.
   # Holds data about each user. Data is collected via Cornell net-id login.
*/

export const Students = new Mongo.Collection('students');
Students.schema = new SimpleSchema({
    _id: { type: String }, // mongo-generated random id for this document
    firstName: { type: String }, // user first name
    lastName: { type: String }, // user last name
    netId: { type: String }, // user netId
    affiliation: { type: String }, // user affliaition, like ENG or A&S
    token: { type: String }, // random token generated during login process
    privilege: { type: String } // user privilege level
});

/* # Subjects Collection
   # List of all course subject groups and their full text names
   # ex: CS -> Computer Science
*/
export const Subjects = new Mongo.Collection('subjects');
Subjects.schema = new SimpleSchema({
    _id: { type: String }, // mongo-generated random id for this document
    subShort: { type: String }, // subject, like "PHIL" or "CS"
    subFull: { type: String } // subject full name, like 'Computer Science'
});

/* # Reviews Collection.
   # Stores each review inputted by a user. Linked with the course that was
   # reviewed via a mapping with on class, which holds the _id attribute of
   # the class from the Classes collection
*/
export const Reviews = new Mongo.Collection('reviews');
Reviews.schema = new SimpleSchema({
    _id: { type: String }, // mongo-generated random id for this document
    user: { type: String, optional: true }, // user who wrote this review, a Users _id
    text: { type: String, optional: true }, // text from the review
    difficulty: { type: Number }, // difficulty measure from the review
    rating: { type: Number }, // quality measure from the review
    workload: { type: Number }, // quality measure from the review
    class: { type: String }, // class the review was for, a Classes _id
    date: { type: Date }, // date/timestamp the review was submited
    visible: { type: Number }, // visibility flag - 1 if visible to users, 0 if only visible to admin
    reported: { type: Number }, // reported flag - 1 if review was reported, 0 otherwise
    professors: { type: [String] }, //list of professors that have thought the course over past semesters
    likes: { type: Number, min: 0 }, //number of likes a review has
});

/* # Validation Collection.
   # Stores passwords and other sensitive application keys.
   # Must be manually populated with data when the app is initialized.
*/
export const Validation = new Mongo.Collection('validation');
Validation.schema = new SimpleSchema({
    _id: { type: String }, // mongo-generated random id for this document
    adminPass: { type: String }, // admin password to validate against
});