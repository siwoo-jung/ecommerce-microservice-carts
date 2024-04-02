import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import { marshall } from "@aws-sdk/util-dynamodb";

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);
const ebClient = new EventBridgeClient();

let res = {
  headers: {},
  statusCode: 0,
  body: {},
};

export const getCarts = async (event) => {
  console.log("getCarts invoked...");
  console.log(event);

  if (!event || !event.body.email) {
    console.log("Failed to find event or event.email");
    res.statusCode = 400;
    res.body = JSON.stringify({ message: "Invalid Access" });
    return res;
  }

  // Gets product data from the product table
  try {
    const email = event.body.email;
    const emailCommand = new GetCommand({
      TableName: process.env.DYNAMODB_TABLE_CARTS,
      Key: {
        email: email,
      },
    });
    const emailResponse = await docClient.send(emailCommand);

    res.statusCode = 200;
    res.body = JSON.stringify(emailResponse.Item.carts);
  } catch (e) {
    console.log(e);
    res.statusCode = 500;
    res.body = JSON.stringify({ message: "Server Error" });
  }
  return res;
};

export const updateCarts = async (event) => {
  console.log("Update Carts Invoked...");
  console.log(event);
  if (!event || !event.body) {
    console.log("Failed to find event or event.body");
    res.statusCode = 400;
    res.body = JSON.stringify({ message: "Invalid Access" });
    return res;
  }

  const newCartInfo = event.body;

  try {
    // Find the user's carts
    const currentCartCommand = new GetCommand({
      TableName: process.env.DYNAMODB_TABLE_CARTS,
      Key: {
        email: newCartInfo.email,
      },
    });

    const currentCartResponse = await docClient.send(currentCartCommand);

    let currentCartInfo = currentCartResponse.Item.carts;

    // Finds whether the same product already exists in the cart
    const duplicated = currentCartInfo.hasOwnProperty(newCartInfo.prodName);

    if (duplicated) {
      const prevQuantity = currentCartInfo[newCartInfo.prodName].quantity;
      const newQuantity = prevQuantity + newCartInfo.quantity;
      const newSubtotal =
        currentCartInfo[newCartInfo.prodName].unitPrice * newQuantity;
      currentCartInfo[newCartInfo.prodName] = {
        ...currentCartInfo[newCartInfo.prodName],
        quantity: newQuantity,
        subtotal: newSubtotal,
      };
    } else {
      currentCartInfo[newCartInfo.prodName] = {
        fullName: newCartInfo.fullName,
        imageURL: newCartInfo.imageURL[0],
        quantity: newCartInfo.quantity,
        unitPrice: newCartInfo.price,
        subtotal: newCartInfo.quantity * newCartInfo.price,
      };
    }

    const command = new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_CARTS,
      Key: {
        email: newCartInfo.email,
      },
      UpdateExpression: "set carts = :v_carts",
      ExpressionAttributeValues: {
        ":v_carts": currentCartInfo,
      },
      ReturnValues: "ALL_NEW",
    });

    const updateResponse = await client.send(command);

    res.statusCode = 200;
    res.body = JSON.stringify({
      message: "Update Successful",
      carts: updateResponse.Attributes.carts,
    });
  } catch (e) {
    console.log(e);
    res.statusCode = 500;
    res.body = JSON.stringify({ message: "Server Error" });
  } finally {
    return res;
  }
};

export const saveCarts = async (event) => {
  console.log("Save Carts Invoked...");
  console.log(event);
  if (!event || !event.body) {
    console.log("Failed to find event or event.body");
    res.statusCode = 400;
    res.body = JSON.stringify({ message: "Invalid Access" });
    return res;
  }

  const newCartInfo = event.body;

  try {
    const command = new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_CARTS,
      Key: {
        email: newCartInfo.email,
      },
      UpdateExpression: "set carts = :v_carts",
      ExpressionAttributeValues: {
        ":v_carts": newCartInfo.cartInfo,
      },
      ReturnValues: "ALL_NEW",
    });

    const updateResponse = await client.send(command);

    res.statusCode = 200;
    res.body = JSON.stringify({
      message: "Update Successful",
      carts: updateResponse.Attributes.carts,
    });
  } catch (e) {
    console.log(e);
    res.statusCode = 500;
    res.body = JSON.stringify({ message: "Server Error" });
  } finally {
    return res;
  }
};

export const checkoutCarts = async (event) => {
  console.log("Checkout Carts Invoked...");
  console.log(event);
  if (!event || !event.body || !event.body.cartInfo || !event.body.email) {
    console.log("Failed to find event or event.body");
    res.statusCode = 400;
    res.body = JSON.stringify({ message: "Invalid Access" });
    return res;
  }

  const cartInfo = event.body.cartInfo;
  const email = event.body.email;

  try {
    // Sending to the eventbridge for the checkout process
    const params = {
      Entries: [
        {
          Source: process.env.EVENT_SOURCE1,
          Detail: JSON.stringify(event.body),
          DetailType: process.env.EVENT_DETAILTYPE1,
          Resources: [],
          EventBusName: process.env.EVENT_BUSNAME,
        },
      ],
    };

    const data = await ebClient.send(new PutEventsCommand(params));

    console.log("Success, event sent; requestID:", data);

    // Emptying carts
    const emptyCartCommand = new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_CARTS,
      Key: {
        email: email,
      },
      UpdateExpression: "set carts = :v_carts",
      ExpressionAttributeValues: {
        ":v_carts": {},
      },
      ReturnValues: "ALL_NEW",
    });

    const emptyCartResponse = await client.send(emptyCartCommand);

    res.statusCode = 200;
    res.body = JSON.stringify({
      message: "Update Successful",
    });
  } catch (e) {
    console.log(e);
    res.statusCode = 500;
    res.body = JSON.stringify({ message: "Server Error" });
  } finally {
    return res;
  }
};

export const addUser = async (event) => {
  console.log("addUser invoked...");
  console.log(event);

  if (!event || !event.detail) {
    console.log("Failed to find event or event.detail");
    res.statusCode = 400;
    res.body = JSON.stringify({ message: "Invalid Access" });
    return res;
  }

  const email = event.detail.email;

  try {
    const command = new PutItemCommand({
      TableName: process.env.DYNAMODB_TABLE_CARTS,
      Item: marshall({
        email: email,
        carts: {},
      }),
    });

    const response = await client.send(command);
    res.statusCode = 200;
    res.body = JSON.stringify({
      message: "Update Successful",
    });
  } catch (e) {
    console.log(e);
    res.statusCode = 500;
    res.body = JSON.stringify({ message: "Server Error" });
  } finally {
    return res;
  }
};
