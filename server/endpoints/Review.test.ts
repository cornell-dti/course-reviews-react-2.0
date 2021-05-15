/* eslint-disable import/prefer-default-export */
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from "express";

import axios from 'axios';
import { TokenPayload } from 'google-auth-library';

import { Review } from 'common';
import { configure } from "../endpoints";
import { Classes, Reviews, Students } from "../dbDefs";
import * as Auth from "./Auth";

let mongoServer: MongoMemoryServer;
let serverCloseHandle;

const testingPort = 8000;

// inital classes that are present at start of all tests.
const testClasses = [
  {
    _id: "oH37S3mJ4eAsktypy",
    classSub: "cs",
    classNum: "2110",
    classTitle: "Object-Oriented Programming and Data Structures",
    classPrereq: [],
    classFull: "cs 2110 object-oriented programming and data structures",
    classSems: ["FA14", "SP15", "SU15", "FA15", "SP16", "SU16", "FA16", "SP17",
      "SU17", "FA17", "SP18", "FA18", "SU18", "SP19", "FA19", "SU19"],
    crossList: ["q75SxmqkTFEfaJwZ3"],
    classProfessors: ["David Gries", "Douglas James", "Siddhartha Chaudhuri",
      "Graeme Bailey", "John Foster", "Ross Tate", "Michael George",
      "Eleanor Birrell", "Adrian Sampson", "Natacha Crooks", "Anne Bracy",
      "Michael Clarkson"],
    classDifficulty: 2.9,
    classRating: null,
    classWorkload: 3,
  },
];

// inital reviews that are present at start of all tests.
const testReviews = [
  {
    _id: "4Y8k7DnX3PLNdwRPr",
    text: "review text for cs 2110",
    user: "User1234",
    difficulty: 1,
    quality: 4,
    class: "oH37S3mJ4eAsktypy",
    grade: 6,
    date: new Date().toISOString(),
    atten: 0,
    visible: 1,
    reported: 0,
    likes: 2,
  },
  {
    _id: "4Y8k7DnX3PLNdwRPq",
    text: "review text for cs 2110 number 2",
    user: "User1234",
    difficulty: 1,
    quality: 5,
    class: "oH37S3mJ4eAsktypy",
    grade: 6,
    date: new Date().toISOString(),
    atten: 0,
    visible: 1,
    reported: 0,
  },
];

const validTokenPayload: TokenPayload = {
  email: 'dti1@cornell.edu',
  iss: undefined,
  sub: undefined,
  iat: undefined,
  aud: undefined,
  exp: undefined,
  hd: "cornell.edu",
};

const mockVerificationTicket = jest.spyOn(Auth, 'getVerificationTicket')
  .mockImplementation(async (token?: string) => validTokenPayload);

beforeAll(async () => {
  // get mongoose all set up
  mongoServer = new MongoMemoryServer();
  const mongoUri = await mongoServer.getUri();
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

  await Promise.all(
    testClasses.map(async (c) => await (new Classes(c).save())),
  );

  await Promise.all(
    testReviews.map(async (r) => await (new Reviews(r).save())),
  );

  // Set up a mock version of the v2 endpoints to test against
  const app = express();
  serverCloseHandle = app.listen(testingPort);
  configure(app);
});

afterAll(async () => {
  await mockVerificationTicket.mockRestore();
  await mongoose.disconnect();
  await mongoServer.stop();
  await serverCloseHandle.close();
});

describe('tests', () => {
  it('getReviewsByCourseId - getting review of class that exists (cs 2110)', async () => {
    const res = await axios.post(`http://localhost:${testingPort}/v2/getReviewsByCourseId`, { courseId: "oH37S3mJ4eAsktypy" });
    expect(res.data.result.length).toBe(testReviews.length);

    const classOfReviews = testReviews.map((r) => r.class);
    expect(res.data.result.map((r) => r.class).sort()).toEqual(classOfReviews.sort());
  });

  it("getReviewsByCourseId - getting review for a class that does not exist", async () => {
    const res = await axios.post(`http://localhost:${testingPort}/v2/getReviewsByCourseId`, { courseId: "ert" });
    expect(res.data.result).toEqual({ error: 'Malformed Query' });
  });

  it("getCourseById - getting cs2110", async () => {
    const res = await axios.post(`http://localhost:${testingPort}/v2/getCourseById`, { courseId: "oH37S3mJ4eAsktypy" });
    expect(res.data.result._id).toBe("oH37S3mJ4eAsktypy");
    expect(res.data.result.classTitle).toBe("Object-Oriented Programming and Data Structures");
  });

  it('getCourseById - class does not exist', async () => {
    const res = await axios.post(`http://localhost:${testingPort}/v2/getCourseById`, { courseId: "blah" });
    expect(res.data.result).toBe(null);
  });

  it('getCourseByInfo - getting cs2110', async () => {
    const res = await axios.post(`http://localhost:${testingPort}/v2/getCourseByInfo`, { subject: "cs", number: "2110" });
    expect(res.data.result._id).toBe("oH37S3mJ4eAsktypy");
    expect(res.data.result.classTitle).toBe("Object-Oriented Programming and Data Structures");
  });

  it('getCourseByInfo - demonstrate regex irrelevance', async () => {
    // Will not accept non-numeric:
    const res1 = await axios.post(`http://localhost:${testingPort}/v2/getCourseByInfo`, { subject: "Vainamoinen", number: "ab2187c" }).catch((e) => e);
    expect(res1.message).toBe("Request failed with status code 400");

    // Will not accept non-ascii:
    const res2 = await axios.post(`http://localhost:${testingPort}/v2/getCourseByInfo`, { subject: "向岛维纳默宁", number: "1234" }).catch((e) => e);
    expect(res2.message).toBe("Request failed with status code 400");

    // Both also does not work:
    const res3 = await axios.post(`http://localhost:${testingPort}/v2/getCourseByInfo`, { subject: "向岛维纳默宁", number: "ab2187c" }).catch((e) => e);
    expect(res3.message).toBe("Request failed with status code 400");
  });

  it("insert Review", async () => {
    const cs2110Id = "oH37S3mJ4eAsktypy";

    const reviewToInsert: Review = {
      _id: "blah",
      user: "dhsn",
      workload: 3,
      professors: ["prof1"],
      isCovid: false,
      text: "sample inserted review for cs 2110. dfghjd76",
      difficulty: 1,
      likedBy: [],
      rating: 4,
    };

    const res = await axios.post(`http://localhost:${testingPort}/v2/insertReview`, { classId: cs2110Id, review: reviewToInsert, token: "fakeTokenDti1" });
    expect(res.data.result.resCode).toBe(1);
    const reviews = await Reviews.find({ text: reviewToInsert.text }).exec();
    expect(reviews.length).toBe(1);

    const dtiUser = await Students.findOne({ netId: "dti1" });
    const review = reviews[0];
    // Was the user logged correctly as the creator of the review?
    expect(review.user).toBe(dtiUser._id);
    // Has the review been added to the creator?
    expect(dtiUser.reviews).toContain(review._id);
  });

  it("like/dislike - increment", async () => {
    const res1 = await axios.post(`http://localhost:${testingPort}/v2/incrementLike`, { id: "4Y8k7DnX3PLNdwRPr", token: "fakeTokenDti1" });

    expect(res1.data.result.resCode).toBe(1);
    expect((await Reviews.findOne({ _id: "4Y8k7DnX3PLNdwRPr" })).likes).toBe(3);

    const res2 = await axios.post(`http://localhost:${testingPort}/v2/incrementLike`, { id: "4Y8k7DnX3PLNdwRPr", token: "fakeTokenDti1" });
    expect(res2.data.result.resCode).toBe(0);
    expect((await Reviews.findOne({ _id: "4Y8k7DnX3PLNdwRPr" })).likes).toBe(3);
  });

  it("like/dislike - decrement", async () => {
    const res = await axios.post(`http://localhost:${testingPort}/v2/decrementLike`, { id: "4Y8k7DnX3PLNdwRPr", token: "fakeTokenDti1" });
    expect(res.data.result.resCode).toBe(1);
    expect((await Reviews.findOne({ _id: "4Y8k7DnX3PLNdwRPr" })).likes).toBe(2);
  });

  it("insert User", async () => {
    const user1 = {
      _id: "Irrelevant",
      firstName: "Cornellius",
      lastName: "Vanderbilt",
      netId: "cv4620",
      affiliation: null,
      token: "fakeTokencv4620",
      privilege: "regular",
    };

    const gObj1 = {
      email: "cv4620@cornell.edu",
      // This is the google people, not us. It has to be this way:
      // https://googleapis.dev/nodejs/google-auth-library/latest/interfaces/TokenPayload.html
      // eslint-disable-next-line @typescript-eslint/camelcase
      given_name: user1.firstName,
      // eslint-disable-next-line  @typescript-eslint/camelcase
      family_name: user1.lastName,
    };

    const res = await axios.post(`http://localhost:${testingPort}/v2/insertUser`, { googleObject: gObj1 });
    expect(res.data.result).toBe(1);
    expect((await Students.find({}).exec()).filter((s) => s.netId === "cv4620").length).toBe(1);
  });

  it("user id's not being leaked by querying reviews", async () => {
    const res = await axios.post(`http://localhost:${testingPort}/v2/getReviewsByCourseId`, { courseId: "oH37S3mJ4eAsktypy" });
    expect(res.data.result.length).toBe(testReviews.length);

    const classOfReviews = testReviews.map((r) => r.user);
    expect(res.data.result.map((r) => r.user).sort()).not.toEqual(classOfReviews.sort());
    expect(res.data.result.map((r) => r.user).sort()).toEqual(["", ""]);
  });
});
