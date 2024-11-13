import { Product } from "../compiled_proto/app";
import { IDatabase } from "../interfaces";
import logger from "../logger";
import { Category, Order, User, UserPatchRequest } from "../types";
import mysql from "mysql2/promise";

export default class MySqlDB implements IDatabase {
    connection: mysql.Connection;

    async init() {
        this.connection = await mysql.createConnection({
            host: process.env.RDS_HOSTNAME,
            user: process.env.RDS_USERNAME,
            password: process.env.RDS_PASSWORD,
            port: parseInt(process.env.RDS_PORT), // Convert port to a number
            database: process.env.RDS_DATABASE,
        });
        logger.info("MySQL connected!");
    }

    constructor() {
        this.init();
    }

    async queryProductById(productId: string) {
        const [result] = await this.connection.query(
            `
      SELECT *
      FROM products
      WHERE id = ?;
      `,
            [productId]
        );
        return result[0] as Product;
    }

    async queryRandomProduct() {
        const [result] = await this.connection.query(`
      SELECT *
      FROM products
      ORDER BY RAND()
      LIMIT 1;
    `);
        return result[0] as Product;
    }

    async queryAllProducts(categoryId?: string) {
        if (categoryId) {
            const [result] = await this.connection.query(
                `
        SELECT *
        FROM products
        WHERE categoryId = ?;
        `,
                [categoryId]
            );
            return result as Product[];
        } else {
            const [result] = await this.connection.query(`
        SELECT *
        FROM products;
      `);
            return result as Product[];
        }
    }

    async queryAllCategories() {
        const [result] = await this.connection.query(`
      SELECT *
      FROM categories;
    `);
        return result as Category[];
    }

    async queryAllOrders() {
        const [result] = await this.connection.query(`
      SELECT *
      FROM orders;
    `);
        return result as Order[];
    }

    async queryOrdersByUser(userId: string) {
        const [result] = await this.connection.query(
            `
      SELECT *
      FROM orders
      WHERE userId = ?;
      `,
            [userId]
        );
        return result as Order[];
    }

    async queryOrderById(orderId: string) {
        const [result] = await this.connection.query(
            `
      SELECT *
      FROM orders
      WHERE id = ?;
      `,
            [orderId]
        );
        return result[0] as Order;
    }

    async queryUserById(userId: string) {
        const [result] = await this.connection.query(
            `
      SELECT id, email, name
      FROM users
      WHERE id = ?;
      `,
            [userId]
        );
        return result[0] as User;
    }

    async queryAllUsers() {
        const [result] = await this.connection.query(`
      SELECT id, name, email
      FROM users;
    `);
        return result as User[];
    }

    async insertOrder(order: Order) {
        // insert the order into the orders table
        await this.connection.query(
            `
      INSERT INTO orders (id, userId, totalAmount)
      VALUES (?, ?, ?);
      `,
            [order.id, order.userId, order.totalAmount]
        );

        // insert order items into the order_items table
        for (const item of order.products) {
            await this.connection.query(
                `
        INSERT INTO order_items (id, orderId, productId, quantity)
        VALUES (?, ?, ?, ?);
        `,
                [
                    `${order.id},${item.productId}`,
                    order.id,
                    item.productId,
                    item.quantity,
                ]
            );
        }
    }

    async updateUser(patch: UserPatchRequest) {
        const fields: string[] = [];
        const values: (string | undefined)[] = [];

        if (patch.email) {
            fields.push("email = ?");
            values.push(patch.email);
        }

        if (patch.password) {
            fields.push("password = ?");
            values.push(patch.password);
        }

        if (fields.length > 0) {
            const query = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
            values.push(patch.id);
            await this.connection.query(query, values);
        }
    }

    async deleteOrder(orderId: string) {
        await this.connection.query(
            `DELETE FROM order_items WHERE orderId = ?`,
            [orderId]
        );
        await this.connection.query(`DELETE FROM orders WHERE id = ?`, [
            orderId,
        ]);
    }
}
