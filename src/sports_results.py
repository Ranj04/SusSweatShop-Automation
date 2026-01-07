"""
Sports Results - Fetches live game results to grade bets
Uses ESPN's public API for scores (no API key required)
"""
import requests
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.settings import SPORT_KEYWORDS


class SportsResults:
    """Fetches sports results from ESPN API"""

    def __init__(self):
        self.espn_base = "https://site.api.espn.com/apis/site/v2/sports"

        # ESPN sport/league mappings
        self.sport_leagues = {
            "NBA": ("basketball", "nba"),
            "NFL": ("football", "nfl"),
            "MLB": ("baseball", "mlb"),
            "NHL": ("hockey", "nhl"),
            "NCAAB": ("basketball", "mens-college-basketball"),
            "NCAAF": ("football", "college-football"),
        }

        # Team name mappings for fuzzy matching
        self.team_aliases = {
            # NBA
            "lakers": "Los Angeles Lakers", "celtics": "Boston Celtics",
            "warriors": "Golden State Warriors", "nets": "Brooklyn Nets",
            "knicks": "New York Knicks", "heat": "Miami Heat",
            "bulls": "Chicago Bulls", "cavs": "Cleveland Cavaliers",
            "cavaliers": "Cleveland Cavaliers", "sixers": "Philadelphia 76ers",
            "76ers": "Philadelphia 76ers", "bucks": "Milwaukee Bucks",
            "suns": "Phoenix Suns", "mavs": "Dallas Mavericks",
            "mavericks": "Dallas Mavericks", "clippers": "LA Clippers",
            "nuggets": "Denver Nuggets", "grizzlies": "Memphis Grizzlies",
            "kings": "Sacramento Kings", "hawks": "Atlanta Hawks",
            # NFL
            "chiefs": "Kansas City Chiefs", "eagles": "Philadelphia Eagles",
            "cowboys": "Dallas Cowboys", "49ers": "San Francisco 49ers",
            "bills": "Buffalo Bills", "ravens": "Baltimore Ravens",
            "bengals": "Cincinnati Bengals", "lions": "Detroit Lions",
            "packers": "Green Bay Packers", "dolphins": "Miami Dolphins",
            "jets": "New York Jets", "patriots": "New England Patriots",
        }

    def get_scoreboard(self, sport: str, date: str = None) -> List[Dict]:
        """
        Get scoreboard for a sport on a given date

        Args:
            sport: Sport code (NBA, NFL, etc.)
            date: Date string YYYYMMDD (defaults to today)

        Returns:
            List of game dictionaries
        """
        if sport not in self.sport_leagues:
            return []

        sport_path, league = self.sport_leagues[sport]

        if date is None:
            date = datetime.now().strftime("%Y%m%d")

        url = f"{self.espn_base}/{sport_path}/{league}/scoreboard"
        params = {"dates": date}

        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            games = []
            for event in data.get("events", []):
                game = self._parse_game(event)
                if game:
                    games.append(game)

            return games
        except requests.RequestException as e:
            print(f"Error fetching {sport} scoreboard: {e}")
            return []

    def _parse_game(self, event: Dict) -> Optional[Dict]:
        """Parse an ESPN event into a simplified game dict"""
        try:
            competition = event.get("competitions", [{}])[0]
            competitors = competition.get("competitors", [])

            if len(competitors) < 2:
                return None

            home_team = None
            away_team = None

            for comp in competitors:
                team_data = {
                    "name": comp.get("team", {}).get("displayName", ""),
                    "abbreviation": comp.get("team", {}).get("abbreviation", ""),
                    "score": int(comp.get("score", 0)) if comp.get("score") else 0,
                    "winner": comp.get("winner", False)
                }
                if comp.get("homeAway") == "home":
                    home_team = team_data
                else:
                    away_team = team_data

            status = competition.get("status", {})

            return {
                "id": event.get("id"),
                "name": event.get("name", ""),
                "date": event.get("date"),
                "status": status.get("type", {}).get("name", ""),
                "status_detail": status.get("type", {}).get("description", ""),
                "completed": status.get("type", {}).get("completed", False),
                "home_team": home_team,
                "away_team": away_team,
                "total_score": (home_team["score"] if home_team else 0) +
                              (away_team["score"] if away_team else 0)
            }
        except Exception as e:
            print(f"Error parsing game: {e}")
            return None

    def find_game_for_pick(self, pick_content: str, sport: str = None) -> Optional[Dict]:
        """
        Find the relevant game for a pick

        Args:
            pick_content: The pick text
            sport: Sport code (optional, will auto-detect)

        Returns:
            Game dictionary or None
        """
        pick_lower = pick_content.lower()

        # Auto-detect sport if not provided
        if not sport:
            sport = self._detect_sport(pick_content)
            if not sport:
                return None

        # Get today's games
        games = self.get_scoreboard(sport)

        # Try to match a team in the pick
        for alias, full_name in self.team_aliases.items():
            if alias in pick_lower:
                # Find game with this team
                for game in games:
                    home = game.get("home_team", {}).get("name", "").lower()
                    away = game.get("away_team", {}).get("name", "").lower()

                    if alias in home or alias in away or \
                       full_name.lower() in home or full_name.lower() in away:
                        return game

        return None

    def _detect_sport(self, content: str) -> Optional[str]:
        """Detect sport from pick content"""
        content_lower = content.lower()

        for sport, keywords in SPORT_KEYWORDS.items():
            if any(kw in content_lower for kw in keywords):
                return sport

        return None

    def grade_pick(self, pick_content: str, game: Dict = None) -> Dict:
        """
        Attempt to grade a pick based on game results

        Args:
            pick_content: The pick text
            game: Game data (optional, will find if not provided)

        Returns:
            Dictionary with result info
        """
        result = {
            "pick": pick_content,
            "graded": False,
            "result": "PENDING",
            "confidence": "low",
            "reason": "Could not find game or determine result"
        }

        if not game:
            game = self.find_game_for_pick(pick_content)

        if not game:
            result["reason"] = "Could not find matching game"
            return result

        if not game.get("completed"):
            result["reason"] = f"Game status: {game.get('status_detail', 'In Progress')}"
            return result

        # Try to determine the bet type and grade
        pick_lower = pick_content.lower()

        # Moneyline bet
        if "ml" in pick_lower or "moneyline" in pick_lower:
            return self._grade_moneyline(pick_content, game)

        # Over/Under bet
        if "over" in pick_lower or "under" in pick_lower:
            return self._grade_total(pick_content, game)

        # Spread bet
        if re.search(r'[+-]\d+\.?\d*', pick_content):
            return self._grade_spread(pick_content, game)

        result["reason"] = "Could not determine bet type"
        return result

    def _grade_moneyline(self, pick_content: str, game: Dict) -> Dict:
        """Grade a moneyline bet"""
        pick_lower = pick_content.lower()

        home_team = game.get("home_team", {})
        away_team = game.get("away_team", {})

        # Determine which team was picked
        picked_home = False
        picked_away = False

        for alias, full_name in self.team_aliases.items():
            if alias in pick_lower:
                if alias in home_team.get("name", "").lower():
                    picked_home = True
                elif alias in away_team.get("name", "").lower():
                    picked_away = True
                break

        if not picked_home and not picked_away:
            return {
                "pick": pick_content,
                "graded": False,
                "result": "PENDING",
                "confidence": "low",
                "reason": "Could not determine which team was picked"
            }

        # Determine winner
        home_won = home_team.get("score", 0) > away_team.get("score", 0)

        if (picked_home and home_won) or (picked_away and not home_won):
            return {
                "pick": pick_content,
                "graded": True,
                "result": "WIN",
                "confidence": "high",
                "reason": f"Final: {home_team.get('name')} {home_team.get('score')} - {away_team.get('name')} {away_team.get('score')}",
                "game": game
            }
        else:
            return {
                "pick": pick_content,
                "graded": True,
                "result": "LOSS",
                "confidence": "high",
                "reason": f"Final: {home_team.get('name')} {home_team.get('score')} - {away_team.get('name')} {away_team.get('score')}",
                "game": game
            }

    def _grade_total(self, pick_content: str, game: Dict) -> Dict:
        """Grade an over/under bet"""
        pick_lower = pick_content.lower()

        # Extract the total line
        total_match = re.search(r'(over|under)\s*(\d+\.?\d*)', pick_lower)
        if not total_match:
            return {
                "pick": pick_content,
                "graded": False,
                "result": "PENDING",
                "confidence": "low",
                "reason": "Could not extract total line"
            }

        bet_direction = total_match.group(1)  # "over" or "under"
        bet_line = float(total_match.group(2))

        actual_total = game.get("total_score", 0)

        # Grade the bet
        if bet_direction == "over":
            won = actual_total > bet_line
        else:
            won = actual_total < bet_line

        # Check for push
        if actual_total == bet_line:
            return {
                "pick": pick_content,
                "graded": True,
                "result": "PUSH",
                "confidence": "high",
                "reason": f"Total: {actual_total} (Line: {bet_line})",
                "game": game
            }

        return {
            "pick": pick_content,
            "graded": True,
            "result": "WIN" if won else "LOSS",
            "confidence": "high",
            "reason": f"Total: {actual_total} (Line: {bet_line})",
            "game": game
        }

    def _grade_spread(self, pick_content: str, game: Dict) -> Dict:
        """Grade a spread bet (simplified)"""
        # This is complex because we need to know which side and the line
        # For now, return pending with medium confidence
        return {
            "pick": pick_content,
            "graded": False,
            "result": "PENDING",
            "confidence": "medium",
            "reason": "Spread bets require manual verification"
        }


def main():
    """Test the sports results fetcher"""
    results = SportsResults()

    print("Fetching NBA scoreboard...")
    games = results.get_scoreboard("NBA")
    print(f"Found {len(games)} games\n")

    for game in games[:3]:
        print(f"  {game['name']}")
        print(f"    Status: {game['status_detail']}")
        print(f"    Score: {game['home_team']['name']} {game['home_team']['score']} - {game['away_team']['name']} {game['away_team']['score']}")
        print()

    # Test grading
    test_picks = [
        "Lakers ML -150",
        "Celtics vs Heat OVER 215.5",
        "Warriors -5.5"
    ]

    print("\nTesting pick grading:")
    for pick in test_picks:
        result = results.grade_pick(pick)
        print(f"\n  Pick: {pick}")
        print(f"    Result: {result['result']}")
        print(f"    Reason: {result['reason']}")


if __name__ == "__main__":
    main()
