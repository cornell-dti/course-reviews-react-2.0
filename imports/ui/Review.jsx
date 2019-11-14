import React, { Component } from 'react';
import moment from 'moment';
import PropTypes from 'prop-types';
import './css/Review.css';

/*
  Review Component.

  Simple styling component that renders a single review (an li element)
  to show in a ClassView. These reivews will include:
   - how long ago the reivew was added
   - all review content
   - report button
   - like button
*/

export default class Review extends Component {
  constructor(props) {
    super(props);

    this.state = {
      liked: false, //indicates whether or not the review has been liked in the current state
    }


  }

  // Function to convert the classId assigned to this review into the
  // full, human-readable name of the class.
  renderClassName(classId) {
    return Meteor.call('getCourseById', classId, (error, result) => {
      if (!error) {
        return result.classTitle;
      } else {
        console.log(error);
      }
    });
  }

  // Convert the reviews's value to a color starting with red and ending with green.
  getColorRedToGreen(value) {
    const colors = ["#E64458", "#E64458", "#f9cc30", "#f9cc30", "#53B277", "#53B277"];
    return {
      backgroundColor: colors[value]
    }
  }

  // Convert the reviews's value to a color starting with green and ending with red.
  getColorGreenToRed(value) {
    const colors = ["#53B277", "#53B277", "#f9cc30", "#f9cc30", "#E64458", "#E64458"];
    if(value == undefined) return {backgroundColor: "#a9a9a9"}
    else return {
      backgroundColor: colors[value],
    }
  }

  // Function that checks whether or not the review has already been liked
  // in the current state. If so, the number of likes decreases by 1 as if removing a like.
  // Otherwise, the number of likes increases by 1.
  increment(review) {
    if (this.state.liked == false) {
      return Meteor.call('incrementLike', review, (error, result) => {
        if (!error && result === 1) {
          this.setState({
            liked: true,
          })
          console.log(this.state.liked);
          console.log("Likes: " + review.likes);
        } else {
          console.log(error)
        }
      });
    }
    else {
      return Meteor.call('decrementLike', review, (error, result) => {
        if (!error && result === 1) {
          this.setState({
            liked: false,
          })
          console.log("Likes: " + review.likes);
        } else {
          console.log(error)
        }
      });
    }

  }

  render() {
    const review = this.props.info;
    // console.log(review);
    // console.log(review.rating);
    return (
      <li>
        <div className="review">
          <div className="col-md-12 col-xs-12 col-xs-12">
            <button className="report-review" onClick={() => {
              this.props.reportHandler(review);
              alert('This post has been reported and will be reviewed.');
            }}>
              <span className="glyphicon glyphicon-flag"
              ></span>
            </button>
          </div>
          <div className="panel-body-3">
            <div className="row reviewNumbers">
              <div className="col-md-2 col-xs-2 col-xs-2" id="circle">
                <div className="container" id="circlebox" style={this.getColorRedToGreen((review.rating != undefined) ? review.rating : review.quality)}>
                  <div className="review-number-text" >{(review.rating != undefined) ? review.rating : review.quality}</div>
                </div>
              </div>
              <div className="col-md-2 col-sm-2 col-xs-2" id="label-wrap">
                <p className="review-number-label">Overall Rating</p>
              </div>
              <div className="col-md-2 col-sm-2 col-xs-2" id="circle">
                <div className="container" id="circlebox" style={this.getColorGreenToRed(review.difficulty)}>
                  <div className="review-number-text" >{review.difficulty}</div>
                </div>
              </div>
              <div className="col-md-2 col-sm-2 col-xs-2" id="label-wrap">
                <p className="review-number-label">Difficulty</p>
              </div>
              <div className="col-md-2 col-xs-2 col-xs-2" id="circle">
                <div className="container" id="circlebox" style={this.getColorGreenToRed(review.workload)}>
                  <div className="review-number-text" >{(review.workload) ? review.workload : "-"}</div>
                </div>
              </div>
              <div className="col-md-2 col-sm-2 col-xs-2" id="label-wrap">
                <p className="review-number-label">Workload</p>
              </div>
            </div>
            <div className="row noLeftRightPadding">
              <div className="col-md-3 col-sm-3 col-xs-3">
                <p className="professor-title">Professor: </p>
              </div>
              <div className="col-md-9 col-sm-9 col-xs-9">
                {/*The following adds a grey professor box for each professor listed in the review*/}
                {(review.professors) ? review.professors.map((prof, index) => (<div key={index} className="col-md-6 col-sm-6 col-xs-6">
                  <p className="professor-text">{prof}</p></div>)) : <div className="col-md-6 col-sm-6 col-xs-6">
                    <p className="professor-text">N/A</p></div>}
              </div>

            </div>
            <div className="row">
              <div className="review-text" >{review.text}</div>
            </div>
            <div className="row noLeftRightPadding">
              <div className="col-md-3 col-sm-3 col-xs-3">
                <p className="review-date"><i>{moment(review.date.toISOString()).fromNow()}</i></p>
              </div>
              <div className="col-md-9 col-sm-9 col-xs-9">
                <button className= //if the review has been liked, the button will be filled in.
                  {(this.state.liked == false ? "upvote btn-lg" : "voted btn-lg")}
                  onClick={() => {
                    this.increment(review);
                  }}>
                  <span className="glyphicon glyphicon-thumbs-up"></span>
                </button>
              </div>
            </div>
            <div className="row">
              <p className="upvote-text">Helpful
              ({(review.likes == undefined ? 0 : review.likes)})</p>
            </div>
          </div>
        </div>
      </li>
    );
  }
}


// takes in the database object representing this review
Review.propTypes = {
  info: PropTypes.object.isRequired,
  reportHandler: PropTypes.func
};
