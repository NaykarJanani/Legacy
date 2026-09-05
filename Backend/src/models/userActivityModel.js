import pool from "../config/db/db_config.js";

export const userActivityModel = {

    saveActivity: async (
        user_id,
        question_id,
        session_id,
        time_spent,
        attempts,
        completed
    ) => {

        const query = `
            INSERT INTO user_activity
            (
                user_id,
                question_id,
                session_id,
                time_spent,
                attempts,
                completed
            )
            VALUES ($1, $2, $3, $4, $5, $6)
        `;

        return await pool.query(query, [
            user_id,
            question_id,
            session_id,
            time_spent,
            attempts,
            completed
        ]);
    },

getDailyActivity: async (date) => {

    const query = `
        SELECT
            ua.user_id,
            u.name as user_name,
            u.email,

            SUM(ua.time_spent) AS total_time_spent,
            COUNT(ua.question_id) AS total_questions,
            SUM(CASE WHEN ua.completed THEN 1 ELSE 0 END) AS completed_questions,
            ROUND(AVG(ua.time_spent)) AS average_time_per_question,

            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'question_id', ua.question_id,
                    'question_text', q.question,
                    'time_spent', ua.time_spent,
                    'attempts', ua.attempts,
                    'completed', ua.completed,
                    'session_title', session_data.session_title
                )
            ) AS activities

        FROM user_activity ua

        LEFT JOIN users u 
            ON ua.user_id = u.user_id

        LEFT JOIN question q 
            ON ua.question_id = q.question_id

        LEFT JOIN (
            SELECT 
                s.session_id,
                s.title AS session_title
            FROM session s
        ) session_data
            ON session_data.session_id = q.session_id

        WHERE DATE(ua.created_at) = $1

        GROUP BY ua.user_id, u.name, u.email
        ORDER BY ua.user_id DESC
    `;

    const result = await pool.query(query, [date]);
    return result.rows;
}
};