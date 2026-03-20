#this is the flask app instance that creates the app object as an instance of the class Flask imported from the flask package

import sqlite3

from flask import Flask
from config import Config
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from sqlalchemy import event
from sqlalchemy.engine import Engine

#create the extension
db = SQLAlchemy()
migrate = Migrate()

# this functions runs whenever a new database connection is made
@event.listens_for(Engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record):
    if isinstance(dbapi_connection, sqlite3.Connection): #check if the connection is to a sqlite database
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON") #enable foreign key constraint enforcement
        cursor.close()


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class) #this loads the configuration setting from the provided config class
    db.init_app(app) #this initializes the SQLAlchemy object with the flask app instance
    migrate.init_app(app, db) #this sets up database migration support for the app using Flask-Migrate

    # Move the import to the very end to avoid circular import issues
    from Backend import models
    from Backend.routes import bp as api_bp
    from Backend.roster_routes import bp as roster_bp
    from Backend.auth_routes import bp as auth_bp
    from Backend.matchup_routes import bp as matchup_bp
    from Backend.match_history_routes import bp as match_history_bp

    app.register_blueprint(api_bp)
    app.register_blueprint(roster_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(matchup_bp)
    app.register_blueprint(match_history_bp)

    return app
