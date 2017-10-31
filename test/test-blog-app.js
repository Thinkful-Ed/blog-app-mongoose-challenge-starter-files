'use strict';
const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const should = chai.should();

const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

function seedBlogData() {
  console.info('seeding blog data');
  const seedData = [];
  
  for (let i=1; i<=10; i++) {
    seedData.push(generateBlogData());
  }
  console.log(seedData);
  // this will return a promise
  return BlogPost.insertMany(seedData);
  
}

//used to generate data to put in db
function generateBlogTitle() {
  const titles = [
    'title1', 'title2', 'title3', 'title4', 'title5'];
  return titles[Math.floor(Math.random() * titles.length)];
}

// function generateAuthor() {
//   const authors = [
//     'author1', 'author2', 'author3', 'author4', 'author5'];
//   return authors[Math.floor(Math.random() * authors.length)];
// }

function generateContent() {
  const contents = [
    'content1', 'content2', 'content3', 'content4', 'content5'];
  return contents[Math.floor(Math.random() * contents.length)];
}

function generateBlogData() {
  return {
    title: generateBlogTitle(),
    author: {
      firstName: faker.company.companyName(),
      LastName: faker.company.companyName()
    },
    content: generateContent()
  };
}
  
function tearDownDb() {
  console.warn('Deleting database');
  return mongoose.connection.dropDatabase();
}


describe('Blogs API resource', function() {
    
  // we need each of these hook functions to return a promise
  // otherwise we'd need to call a `done` callback. `runServer`,
  // `seedRestaurantData` and `tearDownDb` each return a promise,
  // so we return the value returned by these function calls.
  before(function() {
    return runServer(TEST_DATABASE_URL);
  });
    
  beforeEach(function() {
    return seedBlogData();
  });
    
  afterEach(function() {
    return tearDownDb();
  });
    
  after(function() {
    return closeServer();
  });

  describe('GET endpoint', function() {
    
    it('should return all existing blogs', function() {
      // strategy:
      //    1. get back all restaurants returned by by GET request to `/restaurants`
      //    2. prove res has right status, data type
      //    3. prove the number of restaurants we got back is equal to number
      //       in db.
      //
      // need to have access to mutate and access `res` across
      // `.then()` calls below, so declare it here so can modify in place
      let res;
      return chai.request(app)
        .get('/posts')
        .then(function(_res) {
          // so subsequent .then blocks can access resp obj.
          res = _res;
          res.should.have.status(200);
          // otherwise our db seeding didn't work
          res.body.should.have.length.of.at.least(1);
          return BlogPost.count();
        })
        .then(function(count) {
          res.body.should.have.lengthOf(count);
        });
    });

    it('should return restaurants with right fields', function() {
      // Strategy: Get back all restaurants, and ensure they have expected keys
  
      let resBlog;
      return chai.request(app)
        .get('/posts')
        .then(function(res) {
            
          res.should.have.status(200);
          res.should.be.json;
          res.body.should.be.a('array');
          res.body.should.have.length.of.at.least(1);
  
          res.body.forEach(function(blog) {
            blog.should.be.a('object');
            blog.should.include.keys(
              'title', 'author', 'content');
          });
          resBlog = res.body[0];
          return BlogPost.findById(resBlog.id);
        })
        .then(function(blog) {
  
          resBlog.id.should.equal(blog.id);
          resBlog.title.should.equal(blog.title);
          resBlog.author.should.equal(blog.authorName);
          resBlog.content.should.equal(blog.content);
          
          
        });
    });

  });

  describe('POST endpoint', function() {
    // strategy: make a POST request with data,
    // then prove that the restaurant we get back has
    // right keys, and that `id` is there (which means
    // the data was inserted into db)
    it('should add a new blog', function() {

      const newBlog = generateBlogData();
      console.log(newBlog);
      
      return chai.request(app)
        .post('/posts')
        .send(newBlog)
        .then(function(res) {
          console.log(newBlog);
          res.should.have.status(201);
          res.should.be.json;
          res.body.should.be.a('object');
          res.body.should.include.keys(
            'title', 'author', 'content');
          res.body.title.should.equal(newBlog.title);
          // cause Mongo should have created id on insertion
          res.body.id.should.not.be.null;
          res.body.author.should.equal(`${newBlog.author.firstName} ${newBlog.author.lastName}`);
          res.body.content.should.equal(newBlog.content);

          
          return BlogPost.findById(res.body.id);
        })
        .then(function(blog) {
          //blog.id.should.equal(newBlog.id);
          blog.author.firstName.should.equal(newBlog.author.firstName);
          blog.title.should.equal(newBlog.title);
          blog.content.should.equal(newBlog.content);
          
        });
    });
  });

  describe('PUT endpoint', function() {
    
    // strategy:
    //  1. Get an existing restaurant from db
    //  2. Make a PUT request to update that restaurant
    //  3. Prove restaurant returned by request contains data we sent
    //  4. Prove restaurant in db is correctly updated
    it('should update fields you send over', function() {
      const updateData = {
        title: 'fofofofofofofof',
        author: {
          firstName: 'Quang',
          lastName: 'Nguyen'
        },
        content: 'futuristic fusion'
      };
    
      return BlogPost
        .findOne()
        .then(function(blog) {
          updateData.id = blog.id;
    
          // make request then inspect it to make sure it reflects
          // data we sent
          return chai.request(app)
            .put(`/posts/${blog.id}`)
            .send(updateData);
        })
        .then(function(res) {
          res.should.have.status(204);
    
          return BlogPost.findById(updateData.id);
        })
        .then(function(blog) {
          blog.title.should.equal(updateData.title);
          blog.content.should.equal(updateData.content);
          blog.authorName.should.equal(`${updateData.author.firstName} ${updateData.author.lastName}`);
          blog.author.firstName.should.equal(updateData.author.firstName);
        });
    });
  });

  describe('DELETE endpoint', function() {
    // strategy:
    //  1. get a restaurant
    //  2. make a DELETE request for that restaurant's id
    //  3. assert that response has right status code
    //  4. prove that restaurant with the id doesn't exist in db anymore
    it('delete a blog by id', function() {

      let blog;

      return BlogPost
        .findOne()
        .then(function(_blog) {
          blog = _blog;
          return chai.request(app).delete(`/posts/${blog.id}`);
        })
        .then(function(res) {
          res.should.have.status(204);
          return BlogPost.findById(blog.id);
        })
        .then(function(_blog) {
          // when a variable's value is null, chaining `should`
          // doesn't work. so `_restaurant.should.be.null` would raise
          // an error. `should.be.null(_restaurant)` is how we can
          // make assertions about a null value.
          should.not.exist(_blog)
        });
    });
  });




});
