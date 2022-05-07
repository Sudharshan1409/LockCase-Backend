const AWS = require("aws-sdk");
AWS.config.region = process.env.REGION;

const identity = new AWS.CognitoIdentityServiceProvider();

exports.handler = async (event, context, callback) => {
  console.log("event", JSON.stringify(event));
  if (event.request.userAttributes.email) {
    const { email } = event.request.userAttributes;
    const userParams = {
      UserPoolId: event.userPoolId,
      AttributesToGet: ["email"],
      Filter: `email = \"${email}\"`,
      Limit: 1,
    };
    try {
      const { Users } = await identity.listUsers(userParams).promise();
      console.log("Users", { Users });
      if (Users && Users.length > 0) {
        console.log("User already exists");
        callback("EmailExistsException", null);
      } else {
        console.log("No Users exists with the email Id");
        callback(null, event);
      }
    } catch (error) {
      console.log({ error }, JSON.stringify(error));
      callback({ error }, null);
    }
  } else {
    callback("MissingParameters", null);
  }
};
