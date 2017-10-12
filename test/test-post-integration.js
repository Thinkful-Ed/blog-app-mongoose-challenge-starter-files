const chai = require('chai')
const chaiHttp = require('chai-http')
const faker = require('faker')
const mongoose = require('mongoose')

// setup dhould
const should = chai.should()

const {BlogPost} = require('../models')
const {app, runServer, closeServer} = require('../server')
const {TEST_DATABASE_URL} = require('../config')

chai.use(chaiHttp)

// seed data
function seedBlogPostData () {
  console.info('seeding blog post data')
  const seedData = []

  for (let i = 1; i <= 10; i++) {
    seedData.push(generateBlogPostData())
  }
  // this will return a promise
  return BlogPost.insertMany(seedData)
}

// generate post with fake data - title, content, author, date
function generateBlogPostData () {
  return {
    title: faker.lorem.words(),
    content: faker.lorem.paragraphs(),
    author: {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName()
    },
    created: faker.date.recent()
  }
}

// zero database
function tearDownDb () {
  console.warn('Deleting database')
  return mongoose.connection.dropDatabase()
}

describe('Blog app', function () {

  // setup hook functions that each return a promise
  before(function () {
    return runServer(TEST_DATABASE_URL)
  })

  beforeEach(function () {
    return seedBlogPostData()
  })

  afterEach(function () {
    return tearDownDb()
  })

  after(function () {
    return closeServer()
  })

  // test GET endpoint /posts
  describe('GET endpoint', function() {
    it('should return all existing blog posts', function () {
      // Strategy:
      // GET request to `/posts`
      // Check that res has correct status and data type
      // Check that the number of posts we got back is equal to the number in the db

      // need to have access to mutate and access `res` across both .then() blocks
      let res
      return chai.request(app)
        .get('/posts')
        .then(function (_res) {
          // so subsequent .then() blocks can access res:
          res = _res
          res.should.have.status(200)
          res.body.should.have.length.of.at.least(1)
          return BlogPost.count()
        })
        .then(function (count) {
          res.body.should.have.lengthOf(count)
          return Promise.resolve()
        })
    })

    it('should return blog posts with the expected fields', function () {
      // Strategy:
      // Get all blog posts
      // Check that each blog post has expected keys
      // Check that response blog post values match blog post values in db
      let resBlogPost
      return chai.request(app)
        .get('/posts')
        .then(function (res) {
          res.should.have.status(200)
          res.should.be.json
          res.body.should.be.a('array')
          res.body.should.have.length.of.at.least(1)

          res.body.forEach(function (blogpost) {
            blogpost.should.be.a('object')
            blogpost.should.include.all.keys(
              'id', 'author', 'title', 'content', 'created')
          })
          resBlogPost = res.body[0]
          return BlogPost.findById(resBlogPost.id)
        })
        .then(function (blogpost) {
          blogpost.id.should.equal(resBlogPost.id)
          blogpost.title.should.equal(resBlogPost.title)
          blogpost.authorName.should.equal(resBlogPost.author)
          return Promise.resolve()
        })
    })
  })

  // test POST endpoint /posts
  describe('POST endpoint', function () {
    // Strategy:
    // Make a POST request with data
    // Make sure that the blog post we get back has the right keys, and that `id` is there
    // (which means the data was inserted into db)
    it('should add a new blog post', function () {
      const newBlogPost = generateBlogPostData()

      return chai.request(app)
        .post('/posts')
        .send(newBlogPost)
        .then(function (res) {
          res.should.have.status(201)
          res.should.be.json
          res.body.should.be.a('object')
          res.body.should.include.all.keys(
            'id', 'author', 'title', 'content', 'created')
          // Mongo should have created id on insertion
          res.body.id.should.not.be.null
          res.body.title.should.equal(newBlogPost.title)
          res.body.content.should.equal(newBlogPost.content)
          res.body.author.should.equal(`${newBlogPost.author.firstName} ${newBlogPost.author.lastName}`)
          return BlogPost.findById(res.body.id)
        })
        .then(function (blogpost) {
          blogpost.title.should.equal(newBlogPost.title)
          blogpost.content.should.equal(newBlogPost.content)
          blogpost.author.firstName.should.equal(newBlogPost.author.firstName)
          blogpost.author.lastName.should.equal(newBlogPost.author.lastName)
          return Promise.resolve()
        })
    })
  })

// Test PUT endpoint /posts/:id
  describe('PUT endpoint', function () {
    // Strategy:
    //  Get an existing blog post from db
    //  Make a PUT request to update that blog post
    //  Chekc that the blog post returned by request contains data we sent
    //  Check that the blog post in db is correctly updated
    it('should update blog post fields you send over', function () {
      const updateData = {
        title: 'updated title',
        content: 'updated content'
      }

      return BlogPost
        .findOne()
        .then(function (blogpost) {
          updateData.id = blogpost.id

          // make request then inspect it to make sure it matches data we sent
          return chai.request(app)
            .put(`/posts/${blogpost.id}`)
            .send(updateData)
        })
        .then(function (res) {
          res.should.have.status(204)

          return BlogPost.findById(updateData.id)
        })
        .then(function (blogpost) {
          blogpost.title.should.equal(updateData.title)
          blogpost.content.should.equal(updateData.content)
          return Promise.resolve()
        })
    })
  })

  // test DELETE endpoint /posts/:id
  describe('DELETE endpoint', function () {
    it('delete a blog post by id', function () {
      let blogpost

      return BlogPost
        .findOne()
        .then(function (_blogpost) {
          blogpost = _blogpost
          return chai.request(app).delete(`/posts/${blogpost.id}`)
        })
        .then(function (res) {
          res.should.have.status(204)
          return BlogPost.findById(blogpost.id)
        })
        .then(function (_blogpost) {
          // when a variable's value is null, chaining `should`
          // doesn't work. so `_restaurant.should.be.null` would raise
          // an error. `should.be.null(_restaurant)` is how we can
          // make assertions about a null value.
          should.not.exist(_blogpost)
          return Promise.resolve()
        })
    })
  })
})
