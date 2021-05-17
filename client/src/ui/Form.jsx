import React, { Component } from 'react';
import PropTypes from 'prop-types';

import CUreviewsGoogleLogin from './CUreviewsGoogleLogin';
import Select from 'react-select';
import Rodal from 'rodal';
import 'rodal/lib/rodal.css';
import './css/Form.css';
import { Session } from '../session-store';
import { includesProfanity } from "common/profanity";
import axios from 'axios';

import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './css/customToast.css'

/*
  Form Component.

  Container component that displays a form allowing the user to submit a
  single reivew for a given class.

  Takes in a course id for the course this review is for.

  Before inserting a review, it is validated  for illegal characters and to
  ensure all fields are filled in. Form componets are implemented as 'controlled
  components' to run validation, as described at https://goshakkk.name/instant-form-fields-validation-react/
  and in the course review docs.

  Once a review is submitted (with an 'unapproved' flag), the Bart library is
  used to display an alert message telling the user the review was submitted and pending approval,
  or that an error occured.
*/


export default class Form extends Component {
  constructor(props) {
    super(props);

    //Define refs

    this.noProfMsg = React.createRef();
    this.profSelect = React.createRef();
    this.emptyMsg = React.createRef();
    this.textArea = React.createRef();
    this.formElement = React.createRef();
    this.selectHolder = React.createRef();

    //store all currently selected form values in the state.

    this.state = {
      visible: false,
      "rating": 3,
      "ratinglastSelect": 3,
      "diff": 3,
      "difflastSelect": 3,
      "workload": 3,
      "workloadlastSelect": 3,
      text: "",
      postClicks: 0,
      selectedProfessors: [],
      professors: this.props.course.classProfessors ? this.props.course.classProfessors : [], //If class does not have
      //in DB init to empty list
      review: {},
      courseId: '',
      isCovid: false,
      showCovid: true
    };

    for (let i = 1; i <= 5; i++) {
      this.state["diff " + i] = false;
      this.state["rating " + i] = false;
      this.state["workload " + i] = false;
    }

    // store inital values as the default state to revert to after submission
    this.defaultState = this.state
    this.handleProfChange.bind(this)
    this.submitReview = this.submitReview.bind(this)
    this.submitError = this.submitError.bind(this)
    this.saveReviewToSession = this.saveReviewToSession.bind(this)
    this.hide = this.hide.bind(this)
    this.show = this.show.bind(this)
    this.createMetricBoxes = this.createMetricBoxes.bind(this);
    this.handleBoxHoverEnter = this.handleBoxHoverEnter.bind(this);
    this.handleBoxHoverLeave = this.handleBoxHoverLeave.bind(this);
    this.clickMetricBox = this.clickMetricBox.bind(this);
    this.handleCovidBox = this.handleCovidBox.bind(this);
  }

  // Save the current user input text from the text box in the local state.
  // Called whenever this form element changes to trigger re-render to run validation.
  // Updates time user last typed for regular review form, if applicable.
  handleTextChange = (event) => {
    console.log("in handle text change");
    this.setState({ text: event.target.value });
  }



  // Save the current professor selected string for professors in the local state.
  // Called whenever this form element changes to trigger re-render to run validation.
  handleProfChange(selectedProfessors) {

    if (selectedProfessors === null) {
      selectedProfessors = []
    }

    this.setState({ selectedProfessors: selectedProfessors });
  }

  //Called when mouse  enters a metric box to chane highlighting
  handleBoxHoverEnter(metric, i) {
    let currState = this.state[metric + " " + i];
    let lastSelection = this.state[metric + "lastSelect"];
    if (i < lastSelection) this.setState({ [metric]: i });
    for (let j = i; j > this.state[metric]; j--) {
      this.setState({ [metric + " " + j]: !currState });
    }

    for (let j = i + 1; j <= 5; j++) {
      this.setState({ [metric + " " + j]: false });
    }
  }

  //Called when mouse  enters a metric box to chane highlighting
  handleBoxHoverLeave(metric, i) {
    let currState = this.state[metric + " " + i];
    let lastSelection = this.state[metric + "lastSelect"];
    this.setState({ [metric]: lastSelection });
    for (let j = i; j > this.state[metric]; j--) {
      this.setState({ [metric + " " + j]: !currState });
    }
    for (let j = i + 1; j <= 5; j++) {
      this.setState({ [metric + " " + j]: false });
    }
  }

  //Updates the given metric when a box is clicked
  clickMetricBox(metric, i) {
    this.setState({ [metric]: i });
    for (let j = 5; j > this.state[metric]; j--) {
      this.setState({ [metric + " " + j]: false, [metric + "lastSelect"]: i });
    }
  }

  //Creates [max] number of metrix boxes
  createMetricBoxes(max, metric) {
    let boxes = [];
    for (let i = 1; i <= max; i++) {
      let isHovered = this.state[metric + " " + i] ? "boxHover" : "";
      boxes.push(<div className="metricBoxWrapper"
        onClick={() => this.clickMetricBox(metric, i)} onMouseEnter={() => this.handleBoxHoverEnter(metric, i)} onMouseLeave={() => this.handleBoxHoverLeave(metric, i)}>
        <div id={metric + " " + i} className={this.state[metric] < i ? "metricBox inactiveBox " + isHovered : "metricBox activeBox"}></div>
        <p className={this.state[metric] < i ? "inactiveText" : "activeText"}>{i}</p>

      </div>)
    }

    return boxes;
  }


  // Called each time this component is re-rendered, and resets the values of the sliders to 3.
  componentDidMount() {
    //If there is currently a review stored in the session, this means that we have
    // come back from the authentication page
    // In this case, submit the review
    if (Session.get("review") !== undefined && Session.get("review") !== "") {
      this.submitReview();
    }
  }

  // Called each time this component receieves new props.
  // resets the values of the sliders to 3 and sets the state to the default state.
  componentDidUpdate(prevProps) {
    if (prevProps.course !== this.props.course) {
      this.setState(this.defaultState);
    }
  }

  //Saves review input to session before redirecting to Google Authentication
  saveReviewToSession(review) {
    Session.setPersistent({ "review": review });
    Session.setPersistent({ "review_major": this.props.course.classSub.toUpperCase() });
    Session.setPersistent({ "review_num": this.props.course.classNum });
    Session.setPersistent({ "courseId": this.state.courseId });
    if (Session.get("review").id !== review._id // Removed _.isEqual
      && Session.get("review_major") === this.props.course.classSub.toUpperCase()
      && Session.get("review_num") === this.props.course.classNum) {
      console.log("Error saving review data to session");
      return 0;
    }
    // console.log("This is the session after saving token");
    // console.log(Session);
    return 1;
  }

  // Form submission handler. This will either add the review to the database
  // and trigger a success message, or error and ask the user to try again.
  handleSubmit(event) {
    // 'pause' automatic form submisson
    event.preventDefault();
    // ensure all fields are filled out

    const text = this.state.text.trim();
    const rate = this.state.rating;
    const diff = this.state.diff;
    const work = this.state.workload;
    const prof = this.state.selectedProfessors.length !== 0 ? //If length is not 0
      this.state.selectedProfessors.map(professor => { return professor.label }) //set to this
      : //else
      [] //set to this
    const isCovid = this.state.isCovid;

    if (text.length > 0 && text !== null && this.state.selectedProfessors.length > 0) {
      // create new review object
      const newReview = {
        text: text,
        rating: rate,
        difficulty: diff,
        workload: work,
        professors: prof,
        isCovid: isCovid
      };
      this.setState({ "review": newReview })

      // Call save review object to session so that it is not lost when authenicating (redirecting)
      this.saveReviewToSession(newReview);

      this.show();
    }
  }

  createNotification(text, success) {
    toast.configure()
    if (success) {
      toast.success(text, { position: toast.POSITION.TOP_RIGHT })
    }
    else {
      toast.error(text, { position: toast.POSITION.TOP_RIGHT })
    }
  }

  submitReview() {
    // Call the API insert function

    axios.post("/v2/insertReview", {
      token: Session.get("token"),
      review: Session.get("review") !== "" ? Session.get("review") : this.state.review,
      classId: !Session.get("courseId") ? this.props.course._id : Session.get("courseId")
    }).then(response => {
      const res = response.data.result;
      if (res.error || res.resCode === 1) {
        // Success, so reset form

        this.profSelect.current.value = "none";
        // Reset review info to default after review submission
        this.setState(this.defaultState);
        Session.setPersistent({ "review": "" });
        Session.setPersistent({ "review_major": "" });
        Session.setPersistent({ "review_num": "" });
        Session.setPersistent({ "courseId": "" });
        this.hide();
        this.createNotification('Thanks for reviewing! New reviews are updated every 24 hours.', true)
      }
      else {
        console.log(res.error);
        this.createNotification("An unknown error occured, please try again.", false)
        Session.setPersistent({ "review": "" });
        Session.setPersistent({ "review_major": "" });
        Session.setPersistent({ "review_num": "" });
        this.hide();
      }
    });
  }

  submitError() {
    this.hide();
    this.createNotification("You may only submit a review with a @cornell.edu email address, please try again.", false)
  }

  // Validation function. Checks if the median are filled out,
  // and checks text for any unaccepted symbols
  validateInputs(text) {
    //ensure there are no illegal characters
    // TODO un-comment the next line
    const regex = new RegExp(/^(?=.*[A-Z0-9])[\w:;.,?$%*#@[\]!--{}/\\()"'/$ ]+$/i);
    const errs = {
      textEmpty: this.state.postClicks > 0 && (text === null || text === undefined || text.length === 0),
      text: text != null && text !== undefined && text.length > 0 && !regex.test(text),
      professorsEmpty: this.state.postClicks > 0 && (this.state.professors.length > 0 && this.state.selectedProfessors.length === 0),
      profanity: includesProfanity(text),
      allFalse: false
    };
    errs.allTrue = !(errs.text || errs.textEmpty || errs.professorsEmpty || errs.profanity);

    // console.log(errs);
    return errs;
  }

  getProfOptions() {
    if (this.props.course.classProfessors !== []) {
      const profOptions = []
      for (const prof in this.props.course.classProfessors) {
        const professorName = this.props.course.classProfessors[prof]

        profOptions.push({
          "value": professorName,
          "label": professorName
        })
      }
      return profOptions
    }
    else if (this.state.professors !== []) {
      const profOptions = []
      for (const prof in this.state.professors) {
        const professorName = this.state.professors[prof]

        profOptions.push({
          "value": professorName,
          "label": professorName
        })
      }
      return profOptions
    }
  }

  show() {
    this.setState({ visible: true });
  }

  hide() {
    this.setState({ visible: false });
  }

  handleCovidBox(event) {
    console.log(event.target.checked);
    this.setState({ isCovid: event.target.checked });
  }

  renderFormMobile = () => {
    const err = this.validateInputs(this.state.text, this.state.professors);
    const isEnabled = err.allTrue;
    return (
      <div>
        <div className="mobile-form-container">
          <input class="X-button" type="button" onClick={this.props.setShowMobileReviewForm}></input>

          <form className="form" onSubmit={this.handleSubmit.bind(this)} ref={this.formElement}>

            <p className="form-header-text">Leave a Review</p>

            {this.state.showCovid && <label className="covidCheckboxContainer form-bottom-row-spacing2">
              <input
                className="covidCheckboxInput"
                name="isCovid"
                type="checkbox"
                checked={this.state.isCovid}
                onChange={this.handleCovidBox} />
              <span className="covidCheckboxLabel">Taken Virtually</span>
            </label>}

            <div className="row form-bottom-row-spacing">
              <div className="col-md-3 col-sm-3 col-xs-3 form-bottom-row-spacing">
                <div className="form-label form-professor-label">Professor</div>
              </div>
              <div className="col-md-8 col-sm-8 col-xs-8 form-select-alignment" ref={this.selectHolder}>
                <Select
                  className="react-select-container"
                  classNamePrefix="react-select"
                  value={this.state.selectedProfessors}
                  onChange={(professors) => this.handleProfChange(professors)}
                  isMulti
                  options={this.getProfOptions()}
                  ref={this.profSelect}
                  placeholder="Select"
                />
              </div>
            </div>

            <div className="row">
              <div className="col-md-12 col-sm-12 col-xs-12">
                <div ref={this.noProfMsg} className={err.professorsEmpty ? "form-field-error" : "hidden"}>
                  Please select the professor(s) you took this class with!
                      </div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-3 col-sm-3 col-xs-3">
                <h1 className="form-label">Overall</h1>
              </div>
              {this.createMetricBoxes(5, "rating")}
            </div>
            <div className="row form-bottom-row-spacing">
              <div className="col-md-offset-3 col-md-9">
                <div className="metricDescL">Not for me</div>
                <div className="metricDescR">Loved it</div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-3 col-sm-3 col-xs-3">
                <h1 className="form-label">Difficulty</h1>
              </div>
              {this.createMetricBoxes(5, "diff")}
            </div>
            <div className="row form-bottom-row-spacing">
              <div className="col-md-offset-3 col-md-9">
                <div className="metricDescL">Easy</div>
                <div className="metricDescR">Challenging</div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-3 col-sm-3 col-xs-3">
                <h1 className="form-label">Workload</h1>
              </div>
              {this.createMetricBoxes(5, "workload")}
            </div>
            <div className="row">
              <div className="col-md-offset-3 col-md-9">
                <div className="metricDescL">Not so much</div>
                <div className="metricDescR">Lots of work</div>
              </div>
            </div>

            <div className="row form-textbox-row">
              <textarea ref={this.textArea} className={"mobile-textarea form-input-text" + (err.text || err.textEmpty ? "error" : "")} type="text" value={this.state.text}
                onChange={(event) => this.handleTextChange(event)}
              />
              <div ref={this.emptyMsg} className={err.textEmpty ? "form-field-error" : "hidden"}>Please add text to your review!</div>
              <div className={err.text && this.state.text !== "" ? "form-field-error" : "hidden"} id="errorMsg" >Your review contains illegal characters, please remove them.</div>
              <div className={!err.text && !err.textEmpty && err.profanity ? "form-field-error" : "hidden"} id="errorMsg" >Your review contains profanity, please edit your response.</div>
            </div>

            <div className="row form-button-top-bottom-spacing">
              <div className="col-md-12 col-sm-12 col-xs-12">
                <button disabled={!isEnabled} className="form-postbutton" onClick={() => { this.setState({ postClicks: this.state.postClicks + 1 }); }}>Submit</button>
              </div>
            </div>
          </form>
        </div>

        <Rodal animation="zoom" height={520} width={window.innerWidth / 3} measure="px" className="modalForm" visible={this.state.visible} onClose={this.hide.bind(this)}>
          <div id="modal-background">
            <div id="modal-top">
              <img src='/logo.svg' className="img-responsive center-block scale-logo-modal" id="img-padding-top" alt="CU Reviews Logo" />
              <p id="modal-title" className="center-block">Email Verification</p>
            </div>
            <div id="">
              <p id="modal-text" className="center-block">
                You’re almost there! - log in with cornell.edu to
                verify you are a student.
                </p>
              <p id="modal-text" className="center-block">
                (Don’t worry, your identity will always be kept secret!)
                </p>
              <p id="modal-footer" className="center-block">
                You will be redirected to our login page.
                Not seeing it? Click here.
                </p>
              <CUreviewsGoogleLogin
                executeLogin={this.state.visible}
                waitTime={3000}
                redirectFrom="course" />
            </div>
          </div>

        </Rodal>
      </div>
    );
  }

  renderFormDesktop = () => {
    const err = this.validateInputs(this.state.text, this.state.professors);
    const isEnabled = err.allTrue;
    return (
      <div>
        <div className="form-menu">
          <form className="form" onSubmit={this.handleSubmit.bind(this)} ref={this.formElement}>
            <p className="form-header-text">Leave a Review</p>
            <div className="row form-textbox-row">
              <textarea ref={this.textArea} className={"form-input-text" + (err.text || err.textEmpty ? "error" : "")} type="text" value={this.state.text}
                onChange={(event) => this.handleTextChange(event)}
              />
              <div ref={this.emptyMsg} className={err.textEmpty ? "form-field-error" : "hidden"}>Please add text to your review!</div>
              <div className={err.text && this.state.text !== "" ? "form-field-error" : "hidden"} id="errorMsg" >Your review contains illegal characters, please remove them.</div>
              <div className={!err.text && !err.textEmpty && err.profanity ? "form-field-error" : "hidden"} id="errorMsg" >Your review contains profanity, please edit your response.</div>
            </div>


            <div className="row">
              <div className="col-md-3 col-sm-3 col-xs-3 form-bottom-row-spacing">
                <div className="form-label form-professor-label">Professor</div>
              </div>
              <div className="col-md-8 col-sm-8 col-xs-8 form-select-alignment" ref={this.selectHolder}>
                <Select
                  className="react-select-container"
                  classNamePrefix="react-select"
                  value={this.state.selectedProfessors}
                  onChange={(professors) => this.handleProfChange(professors)}
                  isMulti
                  options={this.getProfOptions()}
                  ref={this.profSelect}
                  placeholder="Select"
                />
              </div>
            </div>

            <div className="row">
              <div className="col-md-12 col-sm-12 col-xs-12">
                <div ref={this.noProfMsg} className={err.professorsEmpty ? "form-field-error" : "hidden"}>
                  Please select the professor(s) you took this class with!
                      </div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-3 col-sm-3 col-xs-3">
                <h1 className="form-label">Overall</h1>
              </div>
              {this.createMetricBoxes(5, "rating")}
            </div>
            <div className="row form-bottom-row-spacing">
              <div className="col-md-offset-3 col-md-9 metricDesc-margin-left">
                <div className="metricDescL">Not for me</div>
                <div className="metricDescR">Loved it</div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-3 col-sm-3 col-xs-3">
                <h1 className="form-label">Difficulty</h1>
              </div>
              {this.createMetricBoxes(5, "diff")}
            </div>
            <div className="row form-bottom-row-spacing">
              <div className="col-md-offset-3 col-md-9 metricDesc-margin-left">
                <div className="metricDescL">Piece of cake</div>
                <div className="metricDescR">Challenging</div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-3 col-sm-3 col-xs-3">
                <h1 className="form-label">Workload</h1>
              </div>
              {this.createMetricBoxes(5, "workload")}
            </div>
            <div className="row">
              <div className="col-md-offset-3 col-md-9 metricDesc-margin-left">
                <div className="metricDescL">Not much at all</div>
                <div className="metricDescR">Lots of work</div>
              </div>
            </div>

            {this.state.showCovid && <label className="covidCheckboxContainer">
              <span className="covidCheckboxLabel">Your experience was affected by COVID-19</span>
              <input
                className="covidCheckboxInput"
                name="isCovid"
                type="checkbox"
                checked={this.state.isCovid}
                onChange={this.handleCovidBox} />
            </label>}

            <div className="row form-button-top-bottom-spacing">
              <div className="col-md-12 col-sm-12 col-xs-12">
                <button disabled={!isEnabled} className="form-postbutton" onClick={() => { this.setState({ postClicks: this.state.postClicks + 1 }); }}>Submit</button>
              </div>
            </div>
          </form>
        </div>

        <Rodal animation="zoom" height={520} width={window.innerWidth / 3} measure="px" className="modalForm" visible={this.state.visible} onClose={this.hide.bind(this)}>
          <div id="modal-background">
            <div id="modal-top">
              <img src='/logo.svg' className="img-responsive center-block scale-logo-modal" id="img-padding-top" alt="CU Reviews Logo" />
              <p id="modal-title" className="center-block">Email Verification</p>
            </div>
            <div id="">
              <p id="modal-text" className="center-block">
                You’re almost there! - log in with cornell.edu to
                verify you are a student.
                </p>
              <p id="modal-text" className="center-block">
                (Don’t worry, your identity will always be kept secret!)
                </p>
              <p id="modal-footer" className="center-block">
                You will be redirected to our login page.
                Not seeing it? Click here.
                </p>
              <CUreviewsGoogleLogin
                executeLogin={this.state.visible}
                waitTime={3000}
                redirectFrom="course" />
            </div>
          </div>

        </Rodal>
      </div>
    );
  }


  render() {
    // check to see if all inputs are valid. If some inputs are invalide, disable the
    // post button and add red border around inputs that need to be changed.
    if (Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0) < 993) {
      return this.renderFormMobile()
    }
    else {
      return this.renderFormDesktop()
    }
  }
}

// Form must be provided the course object of the class this review will be for.
Form.propTypes = {
  course: PropTypes.object.isRequired,
  onChange: PropTypes.func
};
