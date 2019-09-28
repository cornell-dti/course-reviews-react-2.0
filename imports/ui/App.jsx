import React, { Component } from 'react';
import SearchBar from './SearchBar.jsx';
import "./css/App.css";

/*
  App Component. Uppermost View component in the component tree,
  the first element of the HTML body tag grabbed by main.html.

  Renders the application homepage with a navbar and searchbar, popular
  classes and recent reviews components.
*/
export default class App extends Component {
  constructor(props) {
    super(props);

    // keep track of user's inputed query to send to SearcBar. Initialize to empty string.
    this.state = {
      query: "",
    };

    // Bind function queryUpdate to this component's state. Required because updateQuery
    // changes the App component's state, but is called in another file (SearchBar component)
    // the 'this' keyword changes depending on the context of the file a function is called in,
    // so we bind this function to the App component to refence it as 'this'
    this.updateQuery.bind(this);
    document.getElementById('googleButton');
  }

  // Set the local state variable 'query' to the current value of the input (given by user)
  // Passed as a prop to SearchBar component, which calls this when user changes their query.
  updateQuery = (event) => {
    // trim the query to remove trailing spaces
    this.setState({ query: event.target.value.trim() });
    //Session to be able to get info from this.state.query in withTracker
    Session.set('querySession', this.state.query);
  }

  render() {
    return (
      <div className="container-fluid full-height background-gradient">

        <div className="row">
          <img src='/logo.png' className="img-responsive center-block scale-logo" id="img-padding-top" alt="CU Reviews Logo" />
        </div>
        <div className="row">
          <div className="col-md-9 col-sm-9 col-xs-9 center-block no-float z-index">
            <SearchBar query={this.state.query} queryFunc={this.updateQuery} />
          </div>
        </div>

        <div className="row">
          <div className="col-md-10 col-md-offset-1">
            <p id="second_welcome_text">Search for your courses, rate your classes, and share your feedback</p>
          </div>
        </div>
        <div className="row footer navbar-fixed-bottom">
          <div className="col-md-12 col-sm-12 col-xs-12 noLeftRightPadding">
            <img src='/skyline.svg' className="center-block outline" id="" alt="" />
          </div>
        </div>
      </div>
    );
  }
}

// takes no props
App.propTypes = {};
