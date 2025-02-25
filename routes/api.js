'use strict';
const mongoose = require('mongoose');

mongoose.connect(process.env.DB)
  .then(() => {
    console.log('Connected to database!');
  })
  .catch((err) => {
    console.error(err);
  });

//Schema Build
const replySchema = new mongoose.Schema({
  text: String,
  delete_password: String,
  created_on: {type: Date, default: Date.now},
  reported: Boolean
});

const threadSchema = new mongoose.Schema({
  board: String,
  text: String,
  delete_password: String,
  created_on: {type: Date, default: Date.now},
  bumped_on: {type: Date, default: Date.now},
  reported: Boolean,
  replies: [replySchema]
});

const Reply = mongoose.model('Reply', replySchema);
const Thread = mongoose.model('Thread', threadSchema);

module.exports = function (app) {
  //Threads controller
  app.route('/api/threads/:board')
    .get(async (req, res) => {
      const threads = (await Thread.find({board: req.params.board}, {
        board: 0,
        delete_password: 0, 
        reported: 0, 
        __v: 0,
        "replies.delete_password": 0,
        "replies.reported": 0
      }).sort({bumped_on: -1})).splice(0, 10);
      threads.forEach(th => {
        th.replies = th.replies.sort((a, b) => new Date(b.created_on) - new Date(a.created_on));
        th.replies.splice(3);
      });
      res.json(threads);
    })
    .post((req, res) => {
      const newThread = new Thread({
        board: req.params.board,
        text: req.body.text,
        delete_password: req.body.delete_password,
        created_on: new Date(),
        bumped_on: new Date(),
        reported: false,
        replies: []
      });
      newThread.save();
      res.redirect('/b/' + req.params.board + '/');
    })
    .put(async (req, res) => {
      await Thread.findByIdAndUpdate(req.body.thread_id,{$set: {reported: true}}, {new: true});
      res.send("reported");
    })
    .delete(async (req, res) => {
      const delThread = await Thread.findById(req.body.thread_id);
      if(req.body.delete_password==delThread.delete_password) {
        await Thread.findByIdAndDelete(req.body.thread_id);
        res.send("success");
      } else {
        res.send("incorrect password");
      }
    });
    
  //Reply Controller
  app.route('/api/replies/:board')
    .get(async (req, res) => {
      const thread = await Thread.findById(req.query.thread_id, {
        board: 0,
        delete_password: 0, 
        reported: 0, 
        __v: 0,
        "replies.delete_password": 0,
        "replies.reported": 0
      });
      res.json(thread);
    })
    .post(async (req, res) => {
      const newReply = new Reply({
        text: req.body.text,
        delete_password: req.body.delete_password,
        reported: false
      });
      const pushThread = await Thread.findByIdAndUpdate(req.body.thread_id, {
        $push: {
          replies: newReply
        },
        $set: {
          bumped_on: newReply.created_on
        }
      }, {new: true});
      res.redirect('/b/' + req.params.board + '/' + pushThread._id);
    })
    .put(async (req, res) => {
      await Thread.findOneAndUpdate({
        _id: req.body.thread_id,
        "replies._id": req.body.reply_id
      },
      {
        $set: {"replies.$.reported": true}
      }, {new: true});
      res.send("reported");
    })
    .delete(async (req, res) => {
      console.log("Reply Delete", req.params.board, req.body);
      const delThread = await Thread.findOneAndUpdate({
        _id: req.body.thread_id,
        "replies": {
          $elemMatch: {
            _id: req.body.reply_id,
            delete_password: req.body.delete_password
          }
        }
      }, {
        $set: {
          "replies.$.text": "[deleted]"
        }
      }, {new: true});
      console.log(delThread);
      if (delThread) {
        res.send("success");
      } else {
        res.send("incorrect password");
      }
    });

};