"""
Props Fetcher - Fetches player props from various betting APIs
Supports PrizePicks (unofficial) and The Odds API (free tier)
"""
import requests
import os
from datetime import datetime
from typing import List, Dict, Optional
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class PropsFetcher:
    """Fetches player props from betting APIs"""

    def __init__(self):
        # The Odds API (free tier - 500 requests/month)
        self.odds_api_key = os.getenv("ODDS_API_KEY", "")
        self.odds_api_base = "https://api.the-odds-api.com/v4"

        # PrizePicks unofficial API
        self.prizepicks_base = "https://partner-api.prizepicks.com"

    def get_prizepicks_projections(self, league: str = None) -> List[Dict]:
        """
        Fetch projections from PrizePicks unofficial API

        Args:
            league: Optional league filter (NBA, NFL, MLB, NHL, etc.)

        Returns:
            List of projection dictionaries
        """
        try:
            url = f"{self.prizepicks_base}/projections"
            params = {"per_page": 250}
            if league:
                params["league"] = league

            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json",
            }

            response = requests.get(url, params=params, headers=headers, timeout=15)
            response.raise_for_status()

            data = response.json()
            projections = []

            # Parse the response - PrizePicks uses JSON:API format
            included = {item["id"]: item for item in data.get("included", [])}

            for proj in data.get("data", []):
                attrs = proj.get("attributes", {})
                relationships = proj.get("relationships", {})

                # Get player info
                player_id = relationships.get("new_player", {}).get("data", {}).get("id")
                player_data = included.get(player_id, {}).get("attributes", {})

                projection = {
                    "id": proj.get("id"),
                    "player_name": player_data.get("display_name", "Unknown"),
                    "team": player_data.get("team", ""),
                    "position": player_data.get("position", ""),
                    "stat_type": attrs.get("stat_type", ""),
                    "line": attrs.get("line_score"),
                    "sport": attrs.get("league", ""),
                    "start_time": attrs.get("start_time"),
                    "description": attrs.get("description", ""),
                    "is_promo": attrs.get("is_promo", False),
                    "odds_type": attrs.get("odds_type", "standard"),
                }
                projections.append(projection)

            print(f"Fetched {len(projections)} projections from PrizePicks")
            return projections

        except requests.RequestException as e:
            print(f"Error fetching PrizePicks projections: {e}")
            return []

    def get_odds_api_props(self, sport: str = "basketball_nba") -> List[Dict]:
        """
        Fetch player props from The Odds API (requires API key)

        Args:
            sport: Sport key (basketball_nba, americanfootball_nfl, etc.)

        Returns:
            List of prop dictionaries
        """
        if not self.odds_api_key:
            print("ODDS_API_KEY not set, skipping The Odds API")
            return []

        try:
            # First get events
            events_url = f"{self.odds_api_base}/sports/{sport}/events"
            params = {"apiKey": self.odds_api_key}

            response = requests.get(events_url, params=params, timeout=15)
            response.raise_for_status()
            events = response.json()

            props = []
            # Get props for each event (limited to save API credits)
            for event in events[:3]:  # Limit to 3 events to conserve free tier
                event_id = event.get("id")
                props_url = f"{self.odds_api_base}/sports/{sport}/events/{event_id}/odds"
                props_params = {
                    "apiKey": self.odds_api_key,
                    "regions": "us",
                    "markets": "player_points,player_rebounds,player_assists",
                    "oddsFormat": "american",
                }

                try:
                    props_response = requests.get(props_url, params=props_params, timeout=15)
                    if props_response.ok:
                        props.extend(props_response.json().get("bookmakers", []))
                except:
                    continue

            print(f"Fetched props for {len(events)} events from The Odds API")
            return props

        except requests.RequestException as e:
            print(f"Error fetching from The Odds API: {e}")
            return []

    def get_todays_popular_props(self, sports: List[str] = None) -> List[Dict]:
        """
        Get today's popular props across sports

        Args:
            sports: List of sports to fetch (default: NBA, NFL based on season)

        Returns:
            List of popular props with player, line, and stat type
        """
        if sports is None:
            # Default to active sports based on time of year
            month = datetime.now().month
            if month in [9, 10, 11, 12, 1]:  # NFL season + NBA
                sports = ["NBA", "NFL"]
            elif month in [2, 3, 4]:  # NBA + March Madness
                sports = ["NBA", "NCAAB"]
            elif month in [5, 6]:  # NBA playoffs + MLB
                sports = ["NBA", "MLB"]
            else:  # Summer
                sports = ["MLB"]

        all_props = []

        for sport in sports:
            props = self.get_prizepicks_projections(league=sport)
            all_props.extend(props)

        # Sort by start time (soonest first) and filter for today
        today = datetime.now().date()
        todays_props = []

        for prop in all_props:
            start_time = prop.get("start_time")
            if start_time:
                try:
                    prop_date = datetime.fromisoformat(start_time.replace("Z", "+00:00")).date()
                    if prop_date == today:
                        todays_props.append(prop)
                except:
                    continue

        # Sort by popularity/visibility - promo props first, then standard
        todays_props.sort(key=lambda x: (not x.get("is_promo", False), x.get("start_time", "")))

        return todays_props[:20]  # Return top 20 props

    def format_props_summary(self, props: List[Dict]) -> str:
        """
        Format props into a readable summary

        Args:
            props: List of prop dictionaries

        Returns:
            Formatted string summary
        """
        if not props:
            return "No props available for today."

        # Group by sport
        by_sport = {}
        for prop in props:
            sport = prop.get("sport", "Other")
            if sport not in by_sport:
                by_sport[sport] = []
            by_sport[sport].append(prop)

        lines = []
        for sport, sport_props in by_sport.items():
            lines.append(f"\n{sport}:")
            for prop in sport_props[:5]:  # Top 5 per sport
                player = prop.get("player_name", "Unknown")
                stat = prop.get("stat_type", "")
                line = prop.get("line", "")
                lines.append(f"  - {player}: {stat} {line}")

        return "\n".join(lines)


def main():
    """Test the props fetcher"""
    fetcher = PropsFetcher()

    print("Fetching today's popular props...")
    props = fetcher.get_todays_popular_props()

    print(f"\nFound {len(props)} props for today")
    print(fetcher.format_props_summary(props))


if __name__ == "__main__":
    main()
