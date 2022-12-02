const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');

const router = express.Router();

router
  .post('/login', async (req, res, next) => {
    try {
      const user = await User.findOne({ username: req.body.username }, '_id username password').exec();

      console.log(user);

      if (!user) {
        return await res.status(404).send({
          token: null,
          message: "User not found!"
        });
      }

      const dbUser = user.toJSON();
      const passwordIsValid = await bcrypt.compare(
        req.body.password,
        dbUser.password
      );

      if (!passwordIsValid) {
        return res.status(401).send({
          token: null,
          message: "Invalid Password!"
        });
      }

      console.log("USER FOUND!");

      const tokenData = { id: dbUser._id, username: dbUser.username },
        token = jwt.sign(tokenData, process.env.SECRET_PRIVATE_KEY, { expiresIn: '14d' });

      return res.status(200).send({
        token,
        message: "User logged!"
      });
    } catch (e) {
      console.log(e.message);
      await res.status(e.code).send({
        message: e.message
      });
    }
  })
  .post('/register', async (req, res, next) => {
    try {
      const newUser = new User({
        username: req.body.username,
        password: req.body.password
      });

      const dbUser = await newUser.save();
      const tokenData = { id: dbUser._id, username: dbUser.username };
      const token = jwt.sign(tokenData, process.env.SECRET_PRIVATE_KEY, { expiresIn: '14d' });

      console.log("new user created!");

      await res.json({
        token
      });
    } catch (e) {
      await res.status(400).send({
        message: e.message
      });
    }
  });

module.exports = router;
