import React, {Component} from 'react';
import { Meteor } from 'meteor/meteor';
import { render } from 'react-dom';

export default class CustomSearch extends Component{
    constructor(props){
        super(props);
        
        //Grabs metrics from GET parameters
        const difficulty  = this.props.match.params.difficulty;
        const workload=this.props.match.params.workload;
        const rating=this.props.match.params.rating;
        const professor=this.props.match.params.professor;

        this.state ={
            difficulty:difficulty,
            workload:workload,
            rating:rating,
            professor:professor
        }
    }

    render(){
       
        return(
             <div>{this.state.difficulty}+" "+{this.state.workload}</div>);

    }
}