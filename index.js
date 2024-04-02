import {
  getCarts,
  updateCarts,
  saveCarts,
  checkoutCarts,
  addUser,
} from "./cartsService.js";

export const handler = async (event) => {
  console.log("Handler initiated");
  console.log(event);
  // GET  /carts            Gets carts info
  try {
    if (event["detail-type"] != undefined) {
      if (event["detail-type"] == process.env.EVENT_DETAILTYPE2) {
        return await addUser(event);
      }
    } else {
      switch (event.httpMethod) {
        case "POST":
          if (event.path == "/carts") {
            return await getCarts(event);
          } else if (event.path == "/carts/update") {
            return await updateCarts(event);
          } else if (event.path == "/carts/save") {
            return await saveCarts(event);
          } else if (event.path == "/carts/checkout") {
            return await checkoutCarts(event);
          }
          break;
        default:
          throw new Error("Invalid access");
      }
    }
  } catch (e) {
    return e;
  }
};
