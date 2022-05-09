// lib/lambda/getLockResults/index.js
var AWS = require("aws-sdk");
AWS.config.update({ region: process.env.REGION });
exports.handler = async (event) => {
  try {
    console.log("event", JSON.stringify(event));
    console.log("REGION", process.env.REGION);
    console.log("LOCK TABLE NAME", process.env.LOCK_TABLE_NAME);
    console.log("UserId", event.requestContext.authorizer.claims.sub);

    const event_body = JSON.parse(event.body);

    console.log("event_body", JSON.stringify(event_body));

    const dynamodb = new AWS.DynamoDB.DocumentClient();

    const response = {
      isBase64Encoded: false,
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        statusCode: 200,
        message: "Success",
      }),
    };
    console.log("response", JSON.stringify(response));
    return response;
  } catch (error) {
    console.log({ error }, JSON.stringify(error));
    return {
      isBase64Encoded: false,
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        statusCode: 500,
        message: "Error",
        error: error,
      }),
    };
  }
};
