import React, { Component, PropTypes } from 'react';
import './css/Review.css';

//Simple Review component - represents a stored review shown to the user when a course is selected.
export default class Review extends Component {
  //props:
  // info, a database object containing all of this review entry's data.

  renderClassName(classId){
    var toShow = ''; //empty div
    return Meteor.call('getCourseById', classId, (error, result) => {
      if (!error) {
        toShow = result.classTitle;
        return result.classTitle;
      } else {
        console.log(error);
      }
    });
    return toShow;
  }

  //get color for quality value
  getQualColor(value) {
    var colors = ["#E64458", "#E64458", "#f9cc30", "#f9cc30", "#53B277", "#53B277"];
    return {
      backgroundColor: colors[value],
    };
}


  render() {
    var review = this.props.info;
    var classId = review.class;
    return (
		<li>
      <div className="row">
        <div className="col-sm-12">
          <p className="classNameLink">
            <i>{moment(review.date.toString()).fromNow()}</i>
          </p>
        </div>
      </div>
      <div className="review">
          <div className="panel-body">
              <div className="row">
                  <div className="col-md-4 col-sm-4 col-xs-5">
                    <div className="row reviewNumbersMargin">
                      <div className="col-md-4 col-sm-4 col-xs-4">
                          <div className="container" id="box" style={this.getQualColor(review.quality)}>
                              <div id="text">{review.quality}</div>
                          </div>
                      </div>
                      <div className="col-md-8 col-sm-8 col-xs-8">
                          <p id="label">Overall Quality</p>
                      </div>
                    </div>
                    <div className="row">
                      <div className="col-md-4 col-sm-4 col-xs-4" >
                          <div className="container" id="box" style={this.getQualColor(5 - review.difficulty)}>
                              <div id="text">{review.difficulty}</div>
                          </div>
                      </div>
                      <div className="col-md-8 col-sm-8 col-xs-8">
                          <p id="label">Difficulty</p>
                      </div>
                    </div>
                    <div className="row">
                      <div className="col-sm-2 col-sm-2 col-xs-2">
                          <button id="button_text" onClick={() => {this.props.reportHandler(review); alert('This post has been reported and will be reviewed.')}}>Report</button>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-7">
                      <div className="review-text" id="review_text">{review.text}</div>
                  </div>
              </div>
            </div>
      </div>
		</li>
    );
  }
}

Review.propTypes = {
  // This component gets the task to display through a React prop.
  // We can use propTypes to indicate it is required
  info: PropTypes.object.isRequired
};
