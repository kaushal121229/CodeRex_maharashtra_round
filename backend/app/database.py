from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.config import settings

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://") and "+asyncpg" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# For SQLite, ensure proper connect args
connect_args = {"check_same_thread": False} if "sqlite" in db_url else {}

engine = create_async_engine(
    db_url,
    echo=False,
    connect_args=connect_args
)


AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

from sqlalchemy import inspect, text

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if "sqlite" in db_url:
            def migrate_sqlite(sync_conn):
                insp = inspect(sync_conn)
                if "sessions" in insp.get_table_names():
                    s_cols = [c["name"] for c in insp.get_columns("sessions")]
                    if "host_id" not in s_cols:
                        sync_conn.execute(text("ALTER TABLE sessions ADD COLUMN host_id VARCHAR(64)"))
                    if "status" not in s_cols:
                        sync_conn.execute(text("ALTER TABLE sessions ADD COLUMN status VARCHAR(32) DEFAULT 'active'"))
                if "participants" in insp.get_table_names():
                    p_cols = [c["name"] for c in insp.get_columns("participants")]
                    if "room_id" not in p_cols:
                        sync_conn.execute(text("ALTER TABLE participants ADD COLUMN room_id VARCHAR(32)"))
                    if "participant_id" not in p_cols:
                        sync_conn.execute(text("ALTER TABLE participants ADD COLUMN participant_id VARCHAR(64)"))
                    if "connection_status" not in p_cols:
                        sync_conn.execute(text("ALTER TABLE participants ADD COLUMN connection_status VARCHAR(32) DEFAULT 'connected'"))
                    if "last_seen_at" not in p_cols:
                        sync_conn.execute(text("ALTER TABLE participants ADD COLUMN last_seen_at DATETIME"))
            await conn.run_sync(migrate_sqlite)
