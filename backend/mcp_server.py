"""MCP server that exposes the flight search tool."""
from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from backend.flights import FlightSearchError, search_flights

mcp = FastMCP('travel-backend-mcp')


@mcp.tool()
async def find_and_show_flights(origin: str, destination: str, departure_date: str) -> list:
    """Find commercial flight offers for the supplied route."""
    try:
        return await search_flights(origin, destination, departure_date)
    except FlightSearchError as exc:
        raise RuntimeError(str(exc)) from exc


if __name__ == '__main__':
    mcp.run()
