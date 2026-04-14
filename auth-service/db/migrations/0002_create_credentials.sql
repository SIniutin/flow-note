-- +goose Up
CREATE TABLE credentials (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_algo VARCHAR(128) NOT NULL,
    password_hash BYTEA NOT NULL,
    CONSTRAINT credentials_password_algo_not_empty CHECK (btrim(password_algo) <> '')
);

-- +goose Down
DROP TABLE IF EXISTS credentials;