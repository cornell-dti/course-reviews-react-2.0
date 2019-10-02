import React, {Component} from 'react';
import { Meteor } from 'meteor/meteor';
import { render } from 'react-dom';

export default class CustomSearch extends Component{
    constructor(props){
        super(props);
        
        //Grabs metrics from GET parameters
        const difficulty  = Number(this.props.match.params.difficulty);
        const workload=Number(this.props.match.params.workload);
        const rating=Number(this.props.match.params.rating);
        const professor=this.props.match.params.professor;
        const grade=Number(this.props.match.params.grade);
        this.componentDidMount=this.componentDidMount.bind(this);
        this.state ={
            grade:grade,
            difficulty:difficulty,
            workload:workload,
            rating:rating,
            professor:professor.split("%20").join(" ")
        }
    }

    // Get courses that satisfy URL parameters
    componentDidMount(){
        var parameters={
            // classProfessors:this.state.professor,
            classRating:{$gte:this.state.rating},
            classWorkload:{$lte:this.state.rating},
            classDifficulty:{$lte:this.state.difficulty},
            // classGrade:{$gte:this.state.grade}
        };
        Meteor.call('getCoursesByFilters', parameters, (error, res)=>{
            if(!error){
                this.setState({results:res});
            }
        });
    }


    render(){
       
        return(
             <div>{this.state.results}</div>);

    }
}