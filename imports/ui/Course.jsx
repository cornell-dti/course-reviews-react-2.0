import React, { Component, PropTypes } from 'react';
import "./css/Course.css";

/*
  Course Component. Represents a single course, shown in the UI as an element of a
  list like the results of a search. The course's data is passed in as a prop.

  If a query is provided as a prop, the component is a seach result, so we underline
  and boldface the query text within the title of the course.

  Clicking this component will change the route of the app to show course details.
*/
export default class Course extends Component {
  render() {
    // generate full human-readable name of class
    var classInfo = this.props.info;
    var text = classInfo.classSub.toUpperCase() + " " + classInfo.classNum + ": " + classInfo.classTitle;

    // check if a query was provided, if so underline parts of the class name
    if (this.props.query) {
      if (text.toLowerCase().indexOf(this.props.query) != -1) {
        startIndex = text.toLowerCase().indexOf(this.props.query);
        endIndex = startIndex + this.props.query.length;
        text = <div>{text.substring(0,startIndex)}<span className='found'>{text.substring(startIndex,endIndex)}</span>{text.substring(endIndex)}</div>
      }
    } else {
      text = <div>{text}</div>
    }

    // return classname as a list element
    return (
      <li className="classbutton" id={classInfo.classSub.toUpperCase() + "_" + classInfo.classNum } >
          <a className="text-style-1" href={`/course/${classInfo.classSub.toUpperCase()}/${classInfo.classNum}`}>
              {text}
          </a>
      </li>
    );
  }
}

// Requres course informaiton to generate course title, and uses the query to
// determine styling of output
Course.propTypes = {
  info: PropTypes.object.isRequired,
  query: PropTypes.string
};
