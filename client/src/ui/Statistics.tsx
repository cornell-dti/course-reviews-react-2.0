import React, { Component } from 'react';

import { Meteor } from "../meteor-shim";
import { Session } from "../meteor-session";
import Accordian from './Accordian';

import { LineChart } from 'react-chartkick';
import 'chart.js';

type Props = any
type State = {
  howManyEachClass: any[];
  howManyReviewsEachClass: any[];
  totalReviews: number;
  chartData: any[];
  step: number;
  range: number;
};


/*
  A Statistics component that gives data concerning the
  database and allows devs to moniter status and progress of the project
*/
export default class Statistics extends Component<Props, State>{
  constructor(props: Props) {
    super(props);

    this.state = {
      howManyEachClass: [],
      howManyReviewsEachClass: [],
      totalReviews: -1,
      chartData: [],
      step: 14,
      range: 12
    };

    this.handleClick = this.handleClick.bind(this);

  }

  componentDidMount() {
    this.howManyEachClass();
    this.howManyReviewsEachClass();
    this.totalReviews();
    this.getChartData();
  }

  getChartData() {
    //{cs: [{date1:totalNum}, {date2: totalNum}, ...], math: [{date1:total}, {date2: total}, ...] }
    Meteor.call('getReviewsOverTimeTop15', Session.get("token"), this.state.step, this.state.range, (err: any, res: any) => {
      let data: any[] = [];
      //key-> EX: cs
      for (let key in res) {
        let finalDateObj: any = {};//{date1:totalNum, date2:totalNum}
        let obj: any = {}; // {name: cs, data: {date1:totalNum, date2:totalNum}}
        obj.name = key;

        //[{date1:totalNum}, {date2: totalNum}, ...]
        let arrDates = res[key];

        arrDates.forEach((arrEntry: any) => {
          let dateObject = Object.keys(arrEntry); //[date1]
          dateObject.forEach(date => {
            finalDateObj[date] = arrEntry[date]
          });
        });

        obj.data = finalDateObj;
        data.push(obj);
      }

      this.setState({ chartData: data });
    });
  }

  howManyReviewsEachClass() {
    Meteor.call('howManyReviewsEachClass', Session.get("token"), (error: any, result: any) => {
      if (error === null) {
        //sort descending
        result.sort((rev1: any, rev2: any) => (rev1.total > rev2.total) ? -1 : 1);
        this.setState({ howManyReviewsEachClass: result });
      } else {
        console.log(error);
      }
    });
  }

  getReviewsPerClassCSV() {
    let strRet = "class,total\n";
    this.state.howManyReviewsEachClass.map((obj) => 
      (strRet += obj._id + "," + obj.total + "\n")
    );
    return strRet;
  }

  howManyEachClass() {
    Meteor.call('howManyEachClass', Session.get("token"), (error: any, result: any) => {
      if (error === null) {
        result.sort((rev1: any, rev2: any) => (rev1.total > rev2.total) ? -1 : 1);
        this.setState({ howManyEachClass: result });
      } else {
        console.log(error);
      }
    });
  }

  totalReviews() {
    Meteor.call('totalReviews', Session.get("token"), (error: any, result: any) => {
      if (!error) {
        this.setState({ totalReviews: result });
      }
      else
        console.log(error);
    });
  }

  handleClick = (e: any) => {
    e.preventDefault();
    this.getChartData();
  }

  downloadCSVFile = () => {
    const element = document.createElement("a");
    const file = new Blob([this.getReviewsPerClassCSV()], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = "ReviewsPerClass.csv";
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  }

  render() {
    return (
      <div>
        <Accordian data={this.state.howManyEachClass} title="Number of Courses in each Dept" col1="Dept" col2="Num of courses" />
        <Accordian data={this.state.howManyReviewsEachClass} title="Number of Reviews in each Class" col1="Class" col2="Num of Reviews" />
        <div>
          <button className="btn btn-primary" onClick={this.downloadCSVFile}>Download CSV For ReviewsPerClass</button>
        </div>
        <p>Total reviews: {this.state.totalReviews}</p>
        <LineChart width="77vw" height="55vh" data={this.state.chartData} />

        <div className="row align-bottom">
          <div className="col-xs-7"> </div>
          <div className="col-xs-2">
            <label htmlFor="range">Range in months</label>
            <input className="form-control " type="number" id="range" name="range" min="1" value={this.state.range} onChange={e => this.setState({ range: parseInt(e.target.value, 10) })} />
          </div>

          <div className="col-xs-2">
            <label htmlFor="step">Step in days</label>
            <input className="form-control" type="number" id="step" name="step" min="1" value={this.state.step} onChange={e => this.setState({ step: parseInt(e.target.value, 10) })} />
          </div>
          <div className="col-xs-1">
            <button type="button" className="btn btn-primary" onClick={this.handleClick}>Load Chart</button>
          </div>
        </div>
      </div>
    )
  }

}
