// lib/lambda/getLockResults/index.js
var AWS = require("aws-sdk");
AWS.config.update({ region: process.env.REGION });
exports.handler = async (event) => {
  try {
    console.log("event", JSON.stringify(event));
    console.log("REGION", process.env.REGION);
    console.log("LOCK TABLE NAME", process.env.LOCK_TABLE_NAME);
    console.log("GROUP TABLE NAME", process.env.GROUP_TABLE_NAME);
    console.log("UserId", event.requestContext.authorizer.claims.sub);

    const dynamodb = new AWS.DynamoDB.DocumentClient();
    const lockParams = {
      TableName: process.env.LOCK_TABLE_NAME,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": event.requestContext.authorizer.claims.sub,
      },
    };
    const lockResponse = await dynamodb.query(lockParams).promise();
    console.log("lockResponse", JSON.stringify(lockResponse));

    const groupParams = {
      TableName: process.env.GROUP_TABLE_NAME,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": event.requestContext.authorizer.claims.sub,
      },
    };

    const groupResponse = await dynamodb.query(groupParams).promise();
    console.log("groupResponse", JSON.stringify(groupResponse));

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
        data: {
          locks: lockResponse.Items,
          groups: groupResponse.Items,
        },
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
