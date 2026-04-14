-- +goose Up
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    login VARCHAR(255) NOT NULL,
    CONSTRAINT users_email_not_empty CHECK (btrim(email) <> ''),
    CONSTRAINT users_login_not_empty CHECK (btrim(login) <> '')
);

CREATE UNIQUE INDEX ux_users_email_lower ON users (lower(email));
CREATE UNIQUE INDEX ux_users_login_lower ON users (lower(login));

-- +goose Down
DROP INDEX IF EXISTS ux_users_login_lower;
DROP INDEX IF EXISTS ux_users_email_lower;
DROP TABLE IF EXISTS users;
