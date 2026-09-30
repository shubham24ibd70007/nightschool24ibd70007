# Nightschool (full stack)

Express + SQLite backend with accounts, cloud-saved progress and a leaderboard.

    npm install
    npm start        # then open http://localhost:3000

Needs Node 22.5 or newer. Set `SECRET` to a long random value before deploying. Without it, a random secret is generated at startup, so local login sessions do not survive a server restart.
