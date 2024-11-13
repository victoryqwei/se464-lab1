import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { IDatabase } from "../interfaces";
import {
    GetCommand,
    ScanCommand,
    PutCommand,
    UpdateCommand,
    DynamoDBDocumentClient,
    DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { Category, Order, Product, User, UserPatchRequest } from "../types";
import logger from "../logger";

export default class DynamoDB implements IDatabase {
    docClient: DynamoDBDocumentClient;

    constructor() {
        const client = new DynamoDBClient({ region: process.env.AWS_REGION });
        this.docClient = DynamoDBDocumentClient.from(client);
        logger.info("DynamoDB connected!");
    }

    async queryRandomProduct() {
        const command = new ScanCommand({
            TableName: "Products",
        });

        const response = await this.docClient.send(command);

        if (response && response.Items) {
            const products = response.Items as Product[];
            const randomIndex = Math.floor(Math.random() * products.length);
            return products[randomIndex];
        }

        throw new Error("No products found.");
    }

    async queryAllCategories() {
        const command = new ScanCommand({
            TableName: "Categories",
        });

        const response = await this.docClient.send(command);
        return response.Items as Category[];
    }

    async queryProductById(productId: string) {
        const command = new GetCommand({
            TableName: "Products",
            Key: {
                id: productId,
            },
        });

        const response = await this.docClient.send(command);
        return response.Item as Product;
    }

    async queryAllProducts(category?: string) {
        let command: ScanCommand;

        if (category) {
            command = new ScanCommand({
                TableName: "Products",
                FilterExpression: "categoryId = :categoryId",
                ExpressionAttributeValues: {
                    ":categoryId": category,
                },
            });
        } else {
            command = new ScanCommand({
                TableName: "Products",
            });
        }

        const response = await this.docClient.send(command);
        return response.Items as Product[];
    }

    async queryAllOrders() {
        const command = new ScanCommand({
            TableName: "Orders",
        });

        const response = await this.docClient.send(command);
        return response.Items as Order[];
    }

    async queryOrdersByUser(userId) {
        const command = new ScanCommand({
            TableName: "Orders",
            FilterExpression: "userId = :userId",
            ExpressionAttributeValues: {
                ":userId": userId,
            },
        });

        const response = await this.docClient.send(command);
        return response.Items as Order[];
    }

    async queryOrderById(userId) {
        const command = new GetCommand({
            TableName: "Orders",
            Key: {
                id: userId,
            },
        });

        const response = await this.docClient.send(command);
        return response.Item as Order;
    }

    async queryUserById(userId) {
        const command = new GetCommand({
            TableName: "Users",
            Key: {
                id: userId,
            },
            ProjectionExpression: "id, #n, email",
            ExpressionAttributeNames: { "#n": "name" },
        });

        const response = await this.docClient.send(command);
        return response.Item as User;
    }

    async queryAllUsers() {
        const command = new ScanCommand({
            TableName: "Users",
            ProjectionExpression: "id, #n, email",
            ExpressionAttributeNames: { "#n": "name" },
        });

        const response = await this.docClient.send(command);
        return response.Items as User[];
    }

    async insertOrder(order: Order): Promise<void> {
        const command = new PutCommand({
            TableName: "Orders",
            Item: order,
        });

        await this.docClient.send(command);

        // delete right after inserting
        await this.deleteOrder(order.id);
    }

    async updateUser(patch: UserPatchRequest): Promise<void> {
        const updateExpressions = [];
        const expressionAttributeNames: Record<string, string> = {};
        const expressionAttributeValues: Record<string, any> = {};

        if (patch.email) {
            updateExpressions.push("#email = :email");
            expressionAttributeNames["#email"] = "email";
            expressionAttributeValues[":email"] = patch.email;
        }

        if (patch.password) {
            updateExpressions.push("#password = :password");
            expressionAttributeNames["#password"] = "password";
            expressionAttributeValues[":password"] = patch.password;
        }

        if (updateExpressions.length === 0) {
            throw new Error("No fields to update.");
        }

        const command = new UpdateCommand({
            TableName: "Users",
            Key: { id: patch.id },
            UpdateExpression: `SET ${updateExpressions.join(", ")}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
        });

        await this.docClient.send(command);
    }

    async deleteOrder(id: string): Promise<void> {
        const command = new DeleteCommand({
            TableName: "Orders",
            Key: {
                id: id,
            },
        });
        await this.docClient.send(command);
    }
}
