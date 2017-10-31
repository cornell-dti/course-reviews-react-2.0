import React, {Component, PropTypes} from 'react';
import {createContainer} from 'meteor/react-meteor-data';
import {Classes} from '../api/classes.js';
import Form from './Form.jsx';
import Course from './Course.jsx';
import CourseCard from './CourseCard.jsx';
import SearchBar from './SearchBar.jsx';
import CourseReviews from './CourseReviews.jsx';
import PopularClasses from './PopularClasses.jsx';
import "./css/App.css";

// App component - represents the whole app
class App extends Component {
  constructor(props) {
    super(props);

    // state of the app will change depending on class selection and current search query
    this.state = {
      selectedClass: null,
      query: ""
    };

    // bind functions called in other files to this context, so that current state is still accessable
    this.handleSelectClass = this.handleSelectClass.bind(this);
    this.updateQuery = this.updateQuery.bind(this);
  }

  //get the full class details for the clicked class. Called in Course.jsx
  handleSelectClass(classId) {
    Meteor.call('getCourseById', classId, (error, result) => {
      if (!error) {
        this.setState({selectedClass: result, query: ""});
      } else {
        console.log(error)
      }
    });
  }

  //set the state variable to the current value of the input. Called in SearchBar.jsx
  updateQuery(event) {
    this.setState({query: event.target.value});
    //Session to be able to get info from this.state.query in createContainer
    Session.set('querySession', this.state.query);
  }

  //check if a class is selected, and show a coursecard only when one is.
  renderCourseCard() {
    var toShow = <div/>; //empty div
    if (this.state.selectedClass !== null) {
      toShow = <CourseCard course={this.state.selectedClass}/>;
    }
    return toShow;
  }

  //check if a class is selected, dispay an add review form only when one is
  renderForm() {
    var toShow = <div/>;
    if (this.state.selectedClass !== null) {
      toShow = <Form courseId={this.state.selectedClass._id}/>;
    }
    return toShow;
  }

  //if query exists, displays classes that match query
  renderCourses() {
    if (this.state.query != "") {
      return this.props.allCourses.slice(0,10).map((course) => (
        //create a new class "button" that will set the selected class to this class when it is clicked.
        <Course key={course._id} info={course} handler={this.handleSelectClass}/>
      ));
    } else {
      return <div />;
    }
  }

  //check if a class is selected. Display past reviews for the class only when one is selected
  //Or display most recent reviews out of all classes if no class is selected
  renderPastReviews() {
    var toShow = <div/>;
    if (this.state.selectedClass !== null) {
      toShow = <CourseReviews courseId={this.state.selectedClass._id}/>;
    } else {
      toShow = <CourseReviews courseId={"-1"}/>;
    }
    return toShow;
  }

  //displays most reviewed classes
  renderPopularClasses() {
    var toShow = <div/>;
    toShow = <PopularClasses clickFunc={this.handleSelectClass}/>;
    return toShow;
  }

  render() {
    if (this.state.selectedClass == null) {
      return (
        <div className="container">
          <div className='row'>
            <nav className="navbar">
              <h1 className="navbar-brand mb-0" id="navname">Cornell Reviews</h1>
            </nav>
          </div>
          <div className='row'>
            <div className="col-md-10 col-md-offset-1">
              <p id="welcome_text">Welcome to Cornell Course Reviews</p>
            </div>
          </div>
          <div className='row'>
            <div id="searchbar"className="col-md-offset-4 panel">
                <input id="search" onChange={this.updateQuery} placeholder="CS 2110, Intro to Creative Writing"/>
                <ul id="output">
                  {this.renderCourses()}
                </ul>
            </div>
          </div>
          <div className='row'>
            <div className="col-md-10 col-md-offset-1">
              <p id="second_welcome_text">Search for your courses, rate your classes, and share your feedback</p>
            </div>
          </div>
          <div className='row'>
            <div className="col-md-6 panel" data-spy="affix">
              {this.renderPopularClasses()}
            </div>
            <div className="col-md-6 panel-container fix-contain">
              <div>
                {this.renderPastReviews()}
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="container">
          <div className='row'>
            <SearchBar query={this.state.query} queryFunc={this.updateQuery} clickFunc={this.handleSelectClass}/>
          </div>
          <div className='row'>
            <div className="col-md-6" data-spy="affix">
              {this.renderCourseCard()}
            </div>
            <div className="col-md-6 panel-container fix-contain">
              <div>
                {this.renderForm()}
              </div>
              <div>
                {this.renderPastReviews()}
              </div>
            </div>
          </div>
        </div>
      );
    }

  }
}

App.propTypes = {
  allCourses: PropTypes.array.isRequired,
  loading: React.PropTypes.bool
};

export default createContainer((props) => {
  //Use Sesssion.get to be able to use this.state.query to filter to Class results
  //See https://forums.meteor.com/t/can-this-state-be-accessed-in-createcontainer-function/20835/13
  const subscription = Meteor.subscribe('classes', Session.get('querySession'));
  const loading = !subscription.ready();
  const allCourses = Classes.find({}).fetch();
  return {
    allCourses, loading,
  };
}, App);
