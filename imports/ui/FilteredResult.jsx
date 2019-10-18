import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './css/Review.css';
import { lastOfferedSems, lastSem, getGaugeValues } from './js/CourseCard.js';

/*
  Filtered Result Component.
*/

export default class FilteredResult extends Component {
  constructor(props) {
    super(props);
    // set gauge values
    this.state = {
      id: this.props.course._id,
      rating: this.props.course.classRating,
      ratingColor: this.props.course.classRatingColor,
      diff: this.props.course.classDifficulty,
      diffColor: this.props.course.classDifficultyColor,
      workload: this.props.course.classWorkload,
      workloadColor: this.props.course.classWorkloadColor,
      grade: this.props.course.classGrade,
      gradeNum: 0,
    };


  }


  render() {
    var theClass = this.props.course;

    // Creates Url that points to each class page on Cornell Class Roster
    var url = "https://classes.cornell.edu/browse/roster/"
      + lastSem(theClass.classSems) + "/class/"
      + theClass.classSub.toUpperCase() + "/"
      + theClass.classNum;

    // Calls function in CourseCard.js that returns a clean version of the last semster class was offered
    var offered = lastOfferedSems(theClass);

    return (
      <li>
        <div id="coursedetails">
          <h1 className="class-title top-margin">
            {theClass.classSub.toUpperCase() + " " + theClass.classNum + ": " + theClass.classTitle}
          </h1>
          <div href={url} target="_blank"> {/* Forces link onto next line */}
            <a className="cornellClassLink" href={url}>Course Roster <img className="padding-bottom" src="https://img.icons8.com/windows/32/000000/external-link.png" width="3%" height="3%" ></img></a>
          </div>
          <p className="class-info spacing-large top-margin">
            <strong>Offered: </strong>
            {offered}
          </p>
          <p className="review-text spacing-large top-margin-small">
            <strong>Median Grade: </strong>
            {this.state.grade}
          </p>
        </div>
      </li>
    );
  }
}


// takes in the database object representing this review
FilteredResult.propTypes = {
  course: PropTypes.object.isRequired
};
