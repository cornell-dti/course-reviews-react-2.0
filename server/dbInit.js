import { HTTP } from 'meteor/http';
import { check, Match} from 'meteor/check';
import { Classes, Users, Subjects, Reviews, Validation } from '../imports/api/dbDefs.js';

/*
  Course API scraper. Uses HTTP requests to get course data from the Cornell
  Course API and stores the results in the local database.

  Functions defined here should be called during app initialization to populate
  the local database or once a semester to add new semester data to the
  local database.

  Functions are called by admins via the admin interface (Admin component).

*/

/* # Populates the Classes and Subjects collections in the local database by grabbing
   # all courses data for the semesters in the semsters array though requests
   # sent to the Cornell Courses API
   #
   # example: semesters = ["SP17", "SP16", "SP15","FA17", "FA16", "FA15"];
   #
   # Using the findAllSemesters() array as input, the function populates an
   # empty database with all courses and subjects.
   # Using findCurrSemester(), the function updates the existing database.
   #
*/
export function addAllCourses(semesters) {
    console.log(semesters);
    for (const semester in semesters) {
        //get all classes in this semester
        console.log("Adding classes for the following semester: " + semesters[semester]);
        const result = HTTP.call("GET", "https://classes.cornell.edu/api/2.0/config/subjects.json?roster=" + semesters[semester], {timeout: 30000});
        if (result.statusCode !== 200) {
            console.log("Error in addAllCourses: 1");
            return 0;
        } else {
            const response = JSON.parse(result.content);
            //console.log(response);
            const sub = response.data.subjects;
            for (const course in sub) {
                const parent = sub[course];
                //if subject doesn't exist add to Subjects collection
                const checkSub = Subjects.find({'subShort' : (parent.value).toLowerCase()}).fetch();
                if (checkSub.length === 0) {
                    console.log("new subject: " + parent.value);
                    Subjects.insert({
                        subShort : (parent.value).toLowerCase(),
                        subFull : parent.descr
                    });
                }

                //for each subject, get all classes in that subject for this semester
                const result2 = HTTP.call("GET", "https://classes.cornell.edu/api/2.0/search/classes.json?roster=" + semesters[semester] + "&subject="+ parent.value, {timeout: 30000});
                if (result2.statusCode !== 200) {
                    console.log("Error in addAllCourses: 2");
                    return 0;
                } else {
                    const response2 = JSON.parse(result2.content);
                    const courses = response2.data.classes;

                    //add each class to the Classes collection if it doesnt exist already
                    for (const course in courses) {
                        try {
                          console.log(courses[course].subject + " " + courses[course].catalogNbr);
                            const check = Classes.find({'classSub' : (courses[course].subject).toLowerCase(), 'classNum' : courses[course].catalogNbr}).fetch();
                            console.log(check);
                            if (check.length === 0) {
                                console.log("new class: " + courses[course].subject + " " + courses[course].catalogNbr + "," + semesters[semester]);
                                //insert new class with empty prereqs and reviews
                                Classes.insert({
                                    classSub : (courses[course].subject).toLowerCase(),
                                    classNum : courses[course].catalogNbr,
                                    classTitle : courses[course].titleLong,
                                    classPrereq : [],
                                    classFull: (courses[course].subject).toLowerCase() + " " + courses[course].catalogNbr +" " + courses[course].titleLong.toLowerCase(),
                                    classSems: [semesters[semester]]
                                });
                            } else {
                                const matchedCourse = check[0] //only 1 should exist
                                const oldSems = matchedCourse.classSems;
                                if (oldSems.indexOf(semesters[semester]) === -1) {
                                    // console.log("update class " + courses[course].subject + " " + courses[course].catalogNbr + "," + semesters[semester]);
                                    oldSems.push(semesters[semester]) //add this semester to the list
                                    Classes.update({_id: matchedCourse._id}, {$set: {classSems: oldSems}})
                                }
                            }
                        } catch(error){
                            console.log("Error in addAllCourses: 3");
                            return 0;
                        }
                    }
                }
            }
        }
    }
    console.log("Finished addAllCourses");
    return 1;
}

const semesterComparator = function(sem1, sem2){
  let year1 = Number(sem1.substring(2));
  let year2 = Number (sem2.substring(2));
  if(year1!=year2) return year2-year1;
  else{
    let semDict={
      "WI":0,
      "SP":1,
      "SU":2,
      "FA":3
    }
    let term1=sem1.substring(0,2);
    let term2=sem2.substring(0,2);
    return semDict[term2]-semDict[term1];
  }
}

export function updateProfessors (semesters){
  //You just want to go through all the classes in the Classes database and update the Professors field
  //Don't want to go through the semesters
  //Might want a helper function that returns that professors for you
    console.log("In updateProfessors method")
    semesters.sort(semesterComparator);
    semesterLoop:
     for (let i=0; i<3; i++) {
        const semester = semesters[i];
        //get all classes in this semester
        console.log(semester);
        try{
          HTTP.call("GET", "https://classes.cornell.edu/api/2.0/config/subjects.json?roster=" + semesters[semester], {timeout: 30000});
        }
        catch(error){
          console.log("Error in updateProfessors: 1");
          console.log(error);
          continue semesterLoop;
        }
        const result = HTTP.call("GET", "https://classes.cornell.edu/api/2.0/config/subjects.json?roster=" + semesters[semester], {timeout: 30000});
        // console.log(result)
        if (result.statusCode !== 200 || result.status == "error") {
            console.log("Error in updateProfessors: 2");
            console.log(result.status);
            continue semesterLoop;
        }

        else {
            const response = JSON.parse(result.content);
            //console.log(response);
            const sub = response.data.subjects; //array of the subjects
            subjectLoop:
            for (const course in sub) {             //for every subject
                const parent = sub[course];
                // console.log("https://classes.cornell.edu/api/2.0/search/classes.json?roster=" + semesters[semester] + "&subject="+ parent.value)
                try{
                  HTTP.call("GET", "https://classes.cornell.edu/api/2.0/search/classes.json?roster=" + semesters[semester] + "&subject="+ parent.value, {timeout: 30000});
                }
                catch(error){
                  console.log("Error in updateProfessors: 3");
                  console.log(error)
                  continue subjectLoop;
                }
                const result2 = HTTP.call("GET", "https://classes.cornell.edu/api/2.0/search/classes.json?roster=" + semesters[semester] + "&subject="+ parent.value, {timeout: 30000});
                if (result2.statusCode !== 200 || result2.status == "error") {
                    console.log("Error in updateProfessors: 4");
                    console.log(result2.status);
                    continue subjectLoop;
                }

                else {
                    const response2 = JSON.parse(result2.content);
                    const courses = response2.data.classes;

                    //add each class to the Classes collection if it doesnt exist already
                    for (const course in courses) {
                        try {
                            const check = Classes.find({'classSub' : (courses[course].subject).toLowerCase(), 'classNum' : courses[course].catalogNbr}).fetch();
                            const matchedCourse = check[0]  //catch this if there is no class existing
                            if (typeof matchedCourse !== "undefined"){
                              // console.log(courses[course].subject);
                              // console.log(courses[course].catalogNbr);
                              // console.log("This is the matchedCourse")
                              console.log(matchedCourse)
                              let oldProfessors = matchedCourse.classProfessors;
                              if (oldProfessors == undefined){
                                oldProfessors = [];
                              }
                              // console.log("This is the length of old profs")
                              // console.log(oldProfessors.length)
                              const classSections = courses[course].enrollGroups[0].classSections     //This returns an array
                              for (const section in classSections){
                                  if (classSections[section].ssrComponent == "LEC" ||
                                      classSections[section].ssrComponent == "SEM"){
                                    // Checks to see if class has scheduled meetings before checking them
                                    if (classSections[section].meetings.length > 0){
                                      const professors = classSections[section].meetings[0].instructors
                                      // Checks to see if class has instructors before checking them
                                      // Example of class without professors is:
                                      // ASRC 3113 in FA16
                                      // ASRC 3113 returns an empty array for professors
                                      if (professors.length > 0){
                                        for (const professor in professors){
                                          const firstName = professors[professor].firstName
                                          const lastName = professors[professor].lastName
                                          const fullName = firstName + " " + lastName
                                          if (!oldProfessors.includes(fullName)){
                                              oldProfessors.push(fullName)
                                              // console.log("This is a new professor")
                                              // console.log(typeof oldProfessors)
                                              // console.log(oldProfessors)
                                          }
                                        }
                                      }
                                      else{
                                        // console.log("This class does not have professors");
                                      }
                                    }
                                    else{
                                      // console.log("This class does not have meetings scheduled");
                                    }
                                  }
                              }
                              Classes.update({_id: matchedCourse._id}, {$set: {classProfessors: oldProfessors}})
                            }
                        }
                        catch(error){
                          console.log("Error in updateProfessors: 5");
                          console.log("Error on course " + courses[course].subject + " " + courses[course].catalogNbr);
                          console.log(error)
                          
                          return 0;
                        }
                    }
                }
              }
        }
    }
    console.log("Finished updateProfessors");
    return 1;
  }
  
  export function resetProfessorArray (semesters){
    // Initializes the classProfessors field in the Classes collection to an empty array so that
    // we have a uniform empty array to fill with updateProfessors
    // Will only have to be called ONCE
      console.log("In resetProfessorArray method")
       for (const semester in semesters) {
          //get all classes in this semester
          const result = HTTP.call("GET", "https://classes.cornell.edu/api/2.0/config/subjects.json?roster=" + semesters[semester], {timeout: 30000});
          if (result.statusCode !== 200) {
              console.log("Error in resetProfessorArray: 1");
              console.log(result.statusCode);
              return 0;
          }

          else {
              const response = JSON.parse(result.content);
              //console.log(response);
              const sub = response.data.subjects; //array of the subjects
              for (const course in sub) {             //for every subject
                  const parent = sub[course];
                  console.log("https://classes.cornell.edu/api/2.0/search/classes.json?roster=" + semesters[semester] + "&subject="+ parent.value)
                  const result2 = HTTP.call("GET", "https://classes.cornell.edu/api/2.0/search/classes.json?roster=" + semesters[semester] + "&subject="+ parent.value, {timeout: 30000});

                  if (result2.statusCode !== 200) {
                      console.log("Error in resetProfessorArray: 2");
                      console.log(result.statusCode);
                      return 0;
                  }

                  else {
                      const response2 = JSON.parse(result2.content);
                      //console.log("PRINTING ALL THE COURSES")
                      const courses = response2.data.classes;
                      //console.log(courses)

                      //add each class to the Classes collection if it doesnt exist already
                      for (const course in courses) {
                          try {
                              const check = Classes.find({'classSub' : (courses[course].subject).toLowerCase(), 'classNum' : courses[course].catalogNbr}).fetch();
                              const matchedCourse = check[0]  //catch this if there is no class existing
                              if (typeof matchedCourse !== "undefined"){
                                console.log(courses[course].subject);
                                console.log(courses[course].catalogNbr);
                                console.log("This is the matchedCourse")
                                console.log(matchedCourse)
                                // var oldProfessors = matchedCourse.classProfessors
                                const oldProfessors = []
                                console.log("This is the length of old profs")
                                console.log(oldProfessors.length)
                                Classes.update({_id: matchedCourse._id}, {$set: {classProfessors: oldProfessors}})
                              }
                          }
                          catch(error){
                            console.log("Error in resetProfessorArray: 5");
                            console.log("Error on course " + courses[course].subject + " " + courses[course].catalogNbr);
                            console.log(error)
                            return 0;
                          }
                      }
                  }
                }
          }
      }
      console.log("professors reset");
      return 1;
    }


export function getProfessorsForClass(){
  //Need the method here to extract the Professor from the response
  //return the array here
}

/* # Grabs the API-required format of the current semester, to be given to the
   # addAllCourses function.
   # Return: String Array (length = 1)
*/
export function findCurrSemester()  {
    let response = HTTP.call("GET", "https://classes.cornell.edu/api/2.0/config/rosters.json", {timeout: 30000});
    if (response.statusCode !== 200) {
        console.log("Error in findCurrSemester");
    } else {
        response = JSON.parse(response.content);
        const allSemesters = response.data.rosters;
        const thisSem = allSemesters[allSemesters.length - 1].slug;
        console.log("Updating for following semester: " + thisSem);
        return [thisSem];
    }
}

/* # Grabs the API-required format of the all recent semesters to be given to the
   # addAllCourses function.
   # Return: String Array
*/
export function findAllSemesters() {
    let response = HTTP.call("GET", "https://classes.cornell.edu/api/2.0/config/rosters.json", {timeout: 30000});
    if (response.statusCode !== 200) {
        console.log("error");
    } else {
        response = JSON.parse(response.content);
        const allSemesters = response.data.rosters;
        return allSemesters.map(function(semesterObject) {
            return semesterObject.slug;
        });
    }
}

/* # Look through all courses in the local database, and identify those
   # that are cross-listed (have multiple official names). Link these classes
   # by adding their course_id to all crosslisted class's crosslist array.
   #
   # Called once during intialization, only after all courses have been added.
*/
export function addCrossList() {
  const semesters = findAllSemesters()
  for (const semester in semesters) {
      //get all classes in this semester
      const result = HTTP.call("GET", "https://classes.cornell.edu/api/2.0/config/subjects.json?roster=" + semesters[semester], {timeout: 30000});
      if (result.statusCode !== 200) {
          console.log("Error in addCrossList: 1");
          return 0;
      } else {
          const response = JSON.parse(result.content);
          //console.log(response);
          const sub = response.data.subjects;
          for (const course in sub) {
              const parent = sub[course];

              //for each subject, get all classes in that subject for this semester
              const result2 = HTTP.call("GET", "https://classes.cornell.edu/api/2.0/search/classes.json?roster=" + semesters[semester] + "&subject="+ parent.value, {timeout: 30000});
              if (result2.statusCode !== 200) {
                  console.log("Error in addCrossList: 2");
                  return 0;
              } else {
                  const response2 = JSON.parse(result2.content);
                  const courses = response2.data.classes;

                  for (const course in courses) {
                      try {
                          const check = Classes.find({'classSub' : (courses[course].subject).toLowerCase(), 'classNum' : courses[course].catalogNbr}).fetch();
                          // console.log((courses[course].subject).toLowerCase() + " "  + courses[course].catalogNbr);
                          // console.log(check);
                          if (check.length > 0) {
                            const crossList = courses[course].enrollGroups[0].simpleCombinations;
                            if (crossList.length > 0) {
                              const crossListIDs = crossList.map(function(crossListedCourse) {
                                console.log(crossListedCourse);
                                const dbCourse = Classes.find({'classSub' : (crossListedCourse.subject).toLowerCase(), 'classNum' : crossListedCourse.catalogNbr}).fetch();
                                //Added the following check because MUSIC 2340
                                //was crosslisted with AMST 2340, which was not in our db
                                //so was causing an error here when calling 'dbCourse[0]._id'
                                //AMST 2340 exists in FA17 but not FA18
                                if (dbCourse[0]){
                                  return dbCourse[0]._id;
                                }
                                else{
                                  return null;
                                }
                              })
                              console.log(courses[course].subject + " " + courses[course].catalogNbr);
                              // console.log(crossListIDs);
                              const thisCourse = check[0];
                              Classes.update({_id: thisCourse._id}, {$set: {crossList: crossListIDs}});
                            }
                          }
                      } catch(error) {
                        console.log("Error in addCrossList: 3");
                          console.log(error);
                          return 0;
                      }
                  }
              }
          }
      }
  }
  console.log("Finished addCrossList");
  return 1;
}
