import React, { Component } from 'react';

import Accordian from './Accordian.jsx';

import { LineChart } from 'react-chartkick';
import 'chart.js';
/*
  A Statistics component that gives data concerning the
  database and allows devs to moniter status and progress of the project
*/
export default class Statistics extends Component{
  constructor(props) {
    super(props);

    this.state={
      howManyEachClass: [],
      howManyReviewsEachClass: [],
      totalReviews: -1,
      chartData: [],
      step: 14,
      range: 12
    }
    this.howManyEachClass();
    this.howManyReviewsEachClass();
    this.totalReviews();
    this.getChartData();
    this.handleClick=this.handleClick.bind(this);
  }

  getChartData(){
    let data=[];
    //{cs: [{date1:totalNum}, {date2: totalNum}, ...], math: [{date1:total}, {date2: total}, ...] }
      Meteor.call('getReviewsOverTimeTop15', Session.get("token"), this.state.step, this.state.range,(err, res)=>{
        //key-> EX: cs
        for(let key in res){
          let finalDateObj={};//{date1:totalNum, date2:totalNum}
          let obj ={}; // {name: cs, data: {date1:totalNum, date2:totalNum}}
          obj.name=key;

          //[{date1:totalNum}, {date2: totalNum}, ...]
          let arrDates = res[key];

          arrDates.forEach((arrEntry)=>{
            let dateObject = Object.keys(arrEntry); //[date1]
            dateObject.map(date=>{
              finalDateObj[date]=arrEntry[date]
            });
          });

          obj.data=finalDateObj;
          data.push(obj);
        }
        this.setState({chartData: data});
      });
  }

  howManyReviewsEachClass(){
    Meteor.call('howManyReviewsEachClass', Session.get("token"), (error, result) =>{
      if(!error){
        //sort descending
        result.sort((rev1, rev2)=>(rev1.total > rev2.total)?-1:1);
        this.setState({howManyReviewsEachClass: result});
      } else{
          console.log(error);
      }
    });
  }

  howManyEachClass(){
    Meteor.call('howManyEachClass', Session.get("token"), (error, result) =>{
      if(!error){
        result.sort((rev1, rev2)=>(rev1.total > rev2.total)?-1:1);
        this.setState({howManyEachClass: result});
      }else{
        console.log(error);
      }
    });
  }

  totalReviews(){
    Meteor.call('totalReviews', Session.get("token"),(error, result)=>{
      if(!error)
        this.setState({totalReviews: result});
      else
        console.log(error);
    });
  }

  handleClick = (e) =>{
    this.getChartData();
  }

  render(){
    return(
      <div>
        <Accordian data={this.state.howManyEachClass} title="Number of Courses in each Dept" col1="Dept" col2="Num of courses"/>
        <Accordian data={this.state.howManyReviewsEachClass} title="Number of Reviews in each Class" col1="Class" col2="Num of Reviews"/>
        <p>Total reviews: {this.state.totalReviews}</p>
        <LineChart width="77vw" height="55vh" data={this.state.chartData} />

        <div className="row align-bottom">
          <div className="col-xs-7"> </div>
          <div className="col-xs-2">
            <label htmlFor="range">Range in months</label>
            <input className="form-control " type="number" id="range" name="range" min="1" value={this.state.range} onInput={e => this.setState({range: parseInt(e.target.value,10)}) }/>
          </div>

          <div className="col-xs-2">
          <label htmlFor="step">Step in days</label>
          <input className="form-control" type="number" id="step" name="step" min="1" value={this.state.step} onInput={e => this.setState({step: parseInt(e.target.value,10)})}/>
          </div>
          <div className="col-xs-1">
          <button type="button" className="btn btn-primary" onClick={this.handleClick}>Load Chart</button>
          </div>
        </div>


    </div>
    )
  }

}
