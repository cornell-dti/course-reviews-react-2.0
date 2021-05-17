import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './css/Review.css';
import ShowMoreText from 'react-show-more-text';
import axios from 'axios';
import { Session } from '../session-store';

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
      numLikes: this.props.info.likes, //the number of likes on the PreviewCard review,
      expanded: false,
      height: this.props.isPreview ? 206 : 196
    }
    this.review_body_container_class = props.isPreview ? "review-body-container-preview" : "review-body-container";
    this.review_number_text_class = props.isPreview ? "review-number-text-preview" : "review-number-text";
    this.review_number_label_class = props.isPreview ? "review-number-label-preview" : "review-number-label";
    this.review_text_class = props.isPreview ? "review-text-preview" : "review-text";
    this.review_body_right_col = props.isPreview ? "review-body-right-col-preview" : "review-body-right-col";
    this.reviewToDate = this.reviewToDate.bind(this);
    this.executeOnClick = this.executeOnClick.bind(this);
  }

  executeOnClick() {

    if (!this.state.expanded) {
      let newHeight = this.state.height + (this.props.info.text.length % 500) / 20 * (this.props.isPreview ? 4.25 : 10.25);
      this.setState({ expanded: !this.state.expanded, height: newHeight });
    }
    else {
      this.setState({ expanded: !this.state.expanded, height: this.props.isPreview ? 206 : 196 });
    }
  }

  // Function that checks whether or not the review has already been liked
  // in the current state. If so, the number of likes decreases by 1 as if removing a like.
  // Otherwise, the number of likes increases by 1.
  increment(review) {
    console.log("here");
    if (this.state.liked === false) {
      axios.post("/v2/incrementLike", { id: review._id, token: Session.get("token") }).then(response => {
        const res = response.data.result;
        if (res.resCode === 1) {
          if (!this.state.numLikes) {
            this.setState({
              liked: true,
              numLikes: 1
            });
          } else {
            this.setState({
              liked: true,
              numLikes: this.state.numLikes + 1
            });
          }
        } else {
          console.log("Error while incrementing likes: " + res.error);
        }
      });
    }
    else {
      axios.post("/v2/decrementLike", { id: review._id, token: Session.get("token") }).then(response => {
        const res = response.data.result;
        if (res.resCode === 1) {
          this.setState({
            liked: false,
            numLikes: this.state.numLikes - 1
          });
        } else {
          console.log("Error while decrementing likes: " + res.error);
        }
      });
    }
  }

  reviewToDate(review) {

    review.date = new Date(review.date);
    let review_year = String(review.date.getFullYear()).substring(2);
    let review_month = review.date.getMonth() + 1;
    let review_day = review.date.getDate();

    return review_month + "/" + review_day + "/" + review_year;
  }

  review_styling = (rev, number_label_class, number_text_class) => {
    if (Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0) < 993) {
      return (
        <div className="col-xl-2 col-lg-3 col-md-4 col-sm-12 review-labels-container noLeftRightPadding">

          <p className={number_label_class}>
            <span className='review-text-label'>Overall</span>
            <span className={number_text_class}>
              {(rev.rating != null) ? rev.rating : rev.quality}
            </span>
            <span>Difficulty</span>
            <span className={number_text_class}>
              {rev.difficulty}
            </span>
            <span>Workload</span>
            <span className={number_text_class}>
              {(rev.workload) ? rev.workload : "-"}
            </span>
          </p>
        </div>
      )
    }
    else {
      return (
        <div className="col-xl-2 col-lg-3 col-md-4 col-sm-12 review-labels-container noLeftRightPadding">

          <p className={number_label_class}>
            <span className="review-number-label-span">Overall</span>
            <span className={number_text_class}>
              {(rev.rating != null) ? rev.rating : rev.quality}
            </span>
          </p>

          <p className={number_label_class}>
            <span className="review-number-label-span">Difficulty</span>
            <span className={number_text_class}>
              {rev.difficulty}
            </span>
          </p>

          <p className={number_label_class}>
            <span className="review-number-label-span">Workload</span>
            <span className={number_text_class}>
              {(rev.workload) ? rev.workload : "-"}
            </span>
          </p>
        </div>
      )
    }

  }

  render() {
    const review = this.props.info;
    return (
      <div className="review-container" style={this.expanded ? { margin: 32 - this.state.height / 80 } : {}} >
        {
          !this.props.isPreview &&
          <div className="row noLeftRightSpacing">
            <div className="col-md-12 col-xs-12 col-xs-12">
              <button className="review-report" onClick={() => {
                this.props.reportHandler(review);
                alert('This post has been reported and will be reviewed.');
              }}>
                <span className="glyphicon glyphicon-flag"
                ></span>
              </button>
            </div>
          </div>
        }
        <div className={"row " + this.review_body_container_class}>
          {this.review_styling(review, this.review_number_label_span, this.review_number_text_class)}
          <div className="col-xl-10 col-lg-9 col-md-8 col-sm-12 noLeftRightPadding">
            <div className="row noLeftRightSpacing review-professor-container">
              <p>
                <span className="review-professor-label">Professor: </span>
                {(review.professors && review.professors.length !== 0) ?
                  review.professors.map((prof, index) =>
                  (<span className="review-professor-text" key={index}>
                    {index > 0 ? ", " : ""}{prof}</span>))
                  : <span className="review-professor-text">N/A</span>
                }
              </p>
            </div>

            <div className="row noLeftRightSpacing">
              <div className={this.review_text_class} >
                <ShowMoreText
                  lines={3}
                  more='Show more'
                  less='Show less'
                  anchorClass='showMoreText'
                  onClick={this.executeOnClick}
                  expanded={this.state.expanded}
                >
                  {review.text}
                </ShowMoreText>
              </div>
              {review.isCovid &&
                <div className="row covidTag">
                  <span role="img" aria-label="alert"> ⚠️</span>This student's experience was affected by COVID-19
              </div>}
              <div className="row">

                <p className="review-date">{this.reviewToDate(review)}</p>
                {!this.props.isPreview &&
                  <button className=
                    {(this.state.liked === true ? "review-voted" : "review-upvote")}
                    onClick={() => {
                      this.increment(review);
                    }}>
                    <img
                      src={this.state.liked ? "/handClap_liked.svg" : "/handClap.svg"}
                      alt={this.state.liked ? "Liked" : "Not Liked Yet"}
                    />
                    <p className="upvote-text">Helpful
                        ({this.state.numLikes ? this.state.numLikes : 0})</p>
                  </button>
                }
              </div>
            </div>
          </div>

        </div>

      </div>
    );
  }
}


// takes in the database object representing this review
Review.propTypes = {
  info: PropTypes.object.isRequired,
  reportHandler: PropTypes.func,
  sortHandler: PropTypes.func,
  isPreview: PropTypes.bool.isRequired,
  likes: PropTypes.number
};
