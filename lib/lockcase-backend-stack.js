const { Stack, Duration, RemovalPolicy } = require("aws-cdk-lib");
const iam = require("aws-cdk-lib/aws-iam");
const cognito = require("aws-cdk-lib/aws-cognito");
const { NodejsFunction } = require("aws-cdk-lib/aws-lambda-nodejs");
const { Runtime } = require("aws-cdk-lib/aws-lambda");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const { Bucket } = require("aws-cdk-lib/aws-s3");
const { RetentionDays } = require("aws-cdk-lib/aws-logs");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const path = require("path");
const backend_json = require("./backend.json");
// const sqs = require('aws-cdk-lib/aws-sqs');

class LockcaseBackendStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const preSignUpTrigger = new NodejsFunction(this, "preSignUpTrigger", {
      description: "Cognito preSignUpTrigger Function",
      functionName: `preSignUpTrigger`,
      runtime: Runtime.NODEJS_14_X,
      handler: "handler",
      bundling: {
        minify: false,
      },
      entry: path.join(__dirname, "./lambda/preSignUpTrigger/index.js"),
      timeout: Duration.seconds(60),
      memorySize: 256,
      environment: {
        REGION: "ap-south-1",
      },
      logRetention: RetentionDays.ONE_MONTH,
    });

    const userPool = new cognito.UserPool(this, "LockCase-Userpool", {
      userPoolName: "LockCase-Userpool",
      removalPolicy: RemovalPolicy.DESTROY,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        fullname: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        first_name: new cognito.StringAttribute({ mutable: true }),
        last_name: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
      },
      lambdaTriggers: {
        preSignUp: preSignUpTrigger,
      },
    });

    preSignUpTrigger.role.attachInlinePolicy(
      new iam.Policy(this, "userpool-listusers-policy", {
        statements: [
          new iam.PolicyStatement({
            actions: ["cognito-idp:ListUsers"],
            resources: [userPool.userPoolArn],
          }),
        ],
      })
    );

    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(
      this,
      "MyUserPoolIdentityProviderGoogle",
      {
        clientId: backend_json.GoogleAppId,
        clientSecret: backend_json.GoogleAppSecret,
        userPool: userPool,

        // the properties below are optional
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          fullname: cognito.ProviderAttribute.GOOGLE_NAME,
          phoneNumber: cognito.ProviderAttribute.GOOGLE_PHONE_NUMBERS,
        },
        scopes: ["email", "profile", "openid", "phone"],
      }
    );

    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
      userPoolClientName: `LockCase-Userpool-Client`,
      generateSecret: false,
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE,
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        callbackUrls: ["http://localhost:3000"],
        logoutUrls: ["http://localhost:3000"],
      },
    });

    const identityPool = new cognito.CfnIdentityPool(
      this,
      "LockCase-IdentityPool",
      {
        allowUnauthenticatedIdentities: false, // Don't allow unathenticated users
        identityPoolName: "LockCase-IdentityPool",
        cognitoIdentityProviders: [
          {
            clientId: userPoolClient.userPoolClientId,
            providerName: userPool.userPoolProviderName,
          },
        ],
      }
    );

    const unauthenticatedRole = new iam.Role(
      this,
      "CognitoDefaultUnauthenticatedRole",
      {
        assumedBy: new iam.FederatedPrincipal(
          "cognito-identity.amazonaws.com",
          {
            StringEquals: {
              "cognito-identity.amazonaws.com:aud": identityPool.ref,
            },
            "ForAnyValue:StringLike": {
              "cognito-identity.amazonaws.com:amr": "unauthenticated",
            },
          },
          "sts:AssumeRoleWithWebIdentity"
        ),
      }
    );

    unauthenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["mobileanalytics:PutEvents", "cognito-sync:*"],
        resources: ["*"],
      })
    );

    const authenticatedRole = new iam.Role(
      this,
      "CognitoDefaultAuthenticatedRole",
      {
        assumedBy: new iam.FederatedPrincipal(
          "cognito-identity.amazonaws.com",
          {
            StringEquals: {
              "cognito-identity.amazonaws.com:aud": identityPool.ref,
            },
            "ForAnyValue:StringLike": {
              "cognito-identity.amazonaws.com:amr": "authenticated",
            },
          },
          "sts:AssumeRoleWithWebIdentity"
        ),
      }
    );
    authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "mobileanalytics:PutEvents",
          "cognito-sync:*",
          "cognito-identity:*",
          "s3:PutObject",
        ],
        resources: ["*"],
      })
    );

    const defaultPolicy = new cognito.CfnIdentityPoolRoleAttachment(
      this,
      "DefaultValid",
      {
        identityPoolId: identityPool.ref,
        roles: {
          unauthenticated: unauthenticatedRole.roleArn,
          authenticated: authenticatedRole.roleArn,
        },
      }
    );

    userPool.addDomain("LockCaseUserpoolDomain", {
      cognitoDomain: {
        domainPrefix: "lock-case-login",
      },
    });

    const lockTable = new dynamodb.Table(this, "LockTable", {
      tableName: "LockTable",
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
    });

    lockTable.addGlobalSecondaryIndex({
      indexName: "LockTableGroupIndex",
      partitionKey: {
        name: "group",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "date",
        type: dynamodb.AttributeType.STRING,
      },
    });

    const groupTable = new dynamodb.Table(this, "groupTable", {
      tableName: "groupTable",
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
    });

    // const lockBucket = new Bucket(this, "LockBucket", {
    //   bucketName: "lock-case-bucket",
    //   removalPolicy: RemovalPolicy.DESTROY,
    // });

    const getLockAndGroup = new NodejsFunction(this, "getLockAndGroup", {
      description: "getLockAndGroup Function",
      functionName: `getLockAndGroup`,
      runtime: Runtime.NODEJS_14_X,
      handler: "handler",
      bundling: {
        minify: false,
      },
      entry: path.join(__dirname, "./lambda/getLockAndGroup/index.js"),
      timeout: Duration.seconds(60),
      memorySize: 256,
      environment: {
        REGION: "ap-south-1",
        LOCK_TABLE_NAME: lockTable.tableName,
        GROUP_TABLE_NAME: groupTable.tableName,
      },
      logRetention: RetentionDays.ONE_MONTH,
    });

    const createLock = new NodejsFunction(this, "createLock", {
      description: "createLock Function",
      functionName: `createLock`,
      runtime: Runtime.NODEJS_14_X,
      handler: "handler",
      bundling: {
        minify: false,
      },
      entry: path.join(__dirname, "./lambda/createLock/index.js"),
      timeout: Duration.seconds(60),
      memorySize: 256,
      environment: {
        REGION: "ap-south-1",
        LOCK_TABLE_NAME: lockTable.tableName,
      },
      logRetention: RetentionDays.ONE_MONTH,
    });

    const createGroup = new NodejsFunction(this, "createGroup", {
      description: "createGroup Function",
      functionName: `createGroup`,
      runtime: Runtime.NODEJS_14_X,
      handler: "handler",
      bundling: {
        minify: false,
      },
      entry: path.join(__dirname, "./lambda/createGroup/index.js"),
      timeout: Duration.seconds(60),
      memorySize: 256,
      environment: {
        REGION: "ap-south-1",
        GROUP_TABLE_NAME: groupTable.tableName,
      },
      logRetention: RetentionDays.ONE_MONTH,
    });

    lockTable.grantReadData(getLockAndGroup);
    groupTable.grantReadData(getLockAndGroup);
    lockTable.grantWriteData(createLock);
    groupTable.grantWriteData(createGroup);

    const getLockAndGroupIntegration = new apigateway.LambdaIntegration(
      getLockAndGroup
    );

    const createLockIntegration = new apigateway.LambdaIntegration(createLock);
    const createGroupIntegration = new apigateway.LambdaIntegration(
      createGroup
    );

    const lockCaseAPI = new apigateway.RestApi(this, "lockCaseAPI", {
      deploy: true,
      deployOptions: {
        stageName: "prod",
      },
      restApiName: "lockCaseAPI",
      cloudWatchRole: true,
    });

    lockCaseAPI.root.addMethod("ANY");

    const auth = new apigateway.CfnAuthorizer(
      this,
      "LockCaseAPIGatewayAuthorizer",
      {
        name: `LockCaseAuthorizer`,
        identitySource: "method.request.header.Authorization",
        providerArns: [userPool.userPoolArn],
        restApiId: lockCaseAPI.restApiId,
        type: "COGNITO_USER_POOLS",
      }
    );

    const locks = lockCaseAPI.root.addResource("locks", {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
      },
    });

    const groups = lockCaseAPI.root.addResource("groups", {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
      },
    });

    locks.addMethod("GET", getLockAndGroupIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: { authorizerId: auth.ref },
    });

    locks.addMethod("POST", createLockIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: { authorizerId: auth.ref },
    });

    groups.addMethod("POST", createGroupIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: { authorizerId: auth.ref },
    });
  }
}

module.exports = { LockcaseBackendStack };
