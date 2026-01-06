"""
Image Fetcher - Gets relevant stock images for tweets
"""
import requests
import os
import re
from typing import Optional, Tuple
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.settings import SPORT_KEYWORDS


class ImageFetcher:
    """Fetches relevant images for sports picks"""

    def __init__(self):
        self.temp_dir = "temp_images"
        os.makedirs(self.temp_dir, exist_ok=True)

        # NBA team logos (using official NBA CDN)
        self.nba_teams = {
            "lakers": "LAL", "celtics": "BOS", "warriors": "GSW", "nets": "BKN",
            "knicks": "NYK", "heat": "MIA", "bulls": "CHI", "cavs": "CLE",
            "cavaliers": "CLE", "sixers": "PHI", "76ers": "PHI", "bucks": "MIL",
            "suns": "PHX", "mavs": "DAL", "mavericks": "DAL", "clippers": "LAC",
            "nuggets": "DEN", "grizzlies": "MEM", "kings": "SAC", "hawks": "ATL",
            "raptors": "TOR", "magic": "ORL", "pacers": "IND", "pistons": "DET",
            "hornets": "CHA", "wizards": "WAS", "thunder": "OKC", "blazers": "POR",
            "jazz": "UTA", "pelicans": "NOP", "wolves": "MIN", "timberwolves": "MIN",
            "spurs": "SAS", "rockets": "HOU"
        }

        # NFL team logos
        self.nfl_teams = {
            "chiefs": "KC", "eagles": "PHI", "cowboys": "DAL", "49ers": "SF",
            "bills": "BUF", "ravens": "BAL", "bengals": "CIN", "lions": "DET",
            "packers": "GB", "dolphins": "MIA", "jets": "NYJ", "patriots": "NE",
            "broncos": "DEN", "raiders": "LV", "chargers": "LAC", "steelers": "PIT",
            "browns": "CLE", "titans": "TEN", "colts": "IND", "jaguars": "JAX",
            "texans": "HOU", "commanders": "WAS", "giants": "NYG", "saints": "NO",
            "buccaneers": "TB", "bucs": "TB", "falcons": "ATL", "panthers": "CAR",
            "seahawks": "SEA", "cardinals": "ARI", "rams": "LAR", "bears": "CHI",
            "vikings": "MIN"
        }

        # Common NBA player names for headshot lookups
        self.nba_players = {
            "lebron": "2544", "curry": "201939", "durant": "201142",
            "giannis": "203507", "luka": "1629029", "doncic": "1629029",
            "embiid": "203954", "jokic": "203999", "tatum": "1628369",
            "maxey": "1630178", "booker": "1626164", "morant": "1629630",
            "edwards": "1630162", "brunson": "1628973", "haliburton": "1630169",
            "mitchell": "1628378", "fox": "1628368", "brown": "1627759",
            "lillard": "203081", "davis": "203076", "butler": "202710",
            "george": "202331", "pg13": "202331", "kawhi": "202695",
            "leonard": "202695", "westbrook": "201566", "harden": "201935",
            "irving": "202681", "kyrie": "202681", "beal": "203078",
            "towns": "1626157", "kat": "1626157", "sga": "1628983",
            "gilgeous-alexander": "1628983", "garland": "1629636",
            "young": "1629027", "trae": "1629027", "lamelo": "1630163",
            "ball": "1630163", "randle": "203944", "siakam": "1627783",
            "vanvleet": "1627832", "adebayo": "1628389", "bam": "1628389"
        }

    def detect_team(self, pick: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Detect team from pick text

        Args:
            pick: The pick text

        Returns:
            Tuple of (team_abbrev, sport) or (None, None)
        """
        pick_lower = pick.lower()

        # Check NBA teams
        for team_name, abbrev in self.nba_teams.items():
            if team_name in pick_lower:
                return abbrev, "NBA"

        # Check NFL teams
        for team_name, abbrev in self.nfl_teams.items():
            if team_name in pick_lower:
                return abbrev, "NFL"

        return None, None

    def detect_player(self, pick: str) -> Optional[str]:
        """
        Detect NBA player from pick text

        Args:
            pick: The pick text

        Returns:
            Player ID or None
        """
        pick_lower = pick.lower()

        for player_name, player_id in self.nba_players.items():
            if player_name in pick_lower:
                return player_id

        return None

    def get_nba_player_headshot(self, player_id: str) -> Optional[str]:
        """
        Get NBA player headshot URL

        Args:
            player_id: NBA player ID

        Returns:
            Image URL or None
        """
        # NBA CDN for player headshots
        url = f"https://cdn.nba.com/headshots/nba/latest/1040x760/{player_id}.png"
        return url

    def get_nba_team_logo(self, team_abbrev: str) -> str:
        """
        Get NBA team logo URL

        Args:
            team_abbrev: Team abbreviation (e.g., LAL, BOS)

        Returns:
            Logo URL
        """
        # NBA CDN for team logos
        return f"https://cdn.nba.com/logos/nba/{self._get_team_id(team_abbrev)}/global/L/logo.svg"

    def _get_team_id(self, abbrev: str) -> str:
        """Get NBA team ID from abbreviation"""
        team_ids = {
            "ATL": "1610612737", "BOS": "1610612738", "BKN": "1610612751",
            "CHA": "1610612766", "CHI": "1610612741", "CLE": "1610612739",
            "DAL": "1610612742", "DEN": "1610612743", "DET": "1610612765",
            "GSW": "1610612744", "HOU": "1610612745", "IND": "1610612754",
            "LAC": "1610612746", "LAL": "1610612747", "MEM": "1610612763",
            "MIA": "1610612748", "MIL": "1610612749", "MIN": "1610612750",
            "NOP": "1610612740", "NYK": "1610612752", "OKC": "1610612760",
            "ORL": "1610612753", "PHI": "1610612755", "PHX": "1610612756",
            "POR": "1610612757", "SAC": "1610612758", "SAS": "1610612759",
            "TOR": "1610612761", "UTA": "1610612762", "WAS": "1610612764"
        }
        return team_ids.get(abbrev, "1610612747")  # Default to Lakers

    def get_generic_sports_image(self, sport: str) -> str:
        """
        Get a generic sports betting image URL

        Args:
            sport: Sport name

        Returns:
            Image URL
        """
        # Using placeholder images - in production, you'd use actual image URLs
        placeholders = {
            "NBA": "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800",
            "NFL": "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800",
            "MLB": "https://images.unsplash.com/photo-1566479179817-e773c82b4c51?w=800",
            "NHL": "https://images.unsplash.com/photo-1515703407324-5f753afd8be8?w=800",
            "default": "https://images.unsplash.com/photo-1461896836934- voices-from-the-stadium?w=800"
        }
        return placeholders.get(sport, placeholders["default"])

    def download_image(self, url: str, filename: str = "tweet_image.png") -> Optional[str]:
        """
        Download image from URL to local file

        Args:
            url: Image URL
            filename: Local filename

        Returns:
            Local file path or None if download failed
        """
        filepath = os.path.join(self.temp_dir, filename)

        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()

            with open(filepath, 'wb') as f:
                f.write(response.content)

            return filepath
        except requests.RequestException as e:
            print(f"Error downloading image: {e}")
            return None

    def get_image_for_pick(self, pick: str) -> Optional[str]:
        """
        Get the best image for a pick

        Args:
            pick: The pick text

        Returns:
            Local file path to downloaded image, or None
        """
        # Try to get player headshot first
        player_id = self.detect_player(pick)
        if player_id:
            url = self.get_nba_player_headshot(player_id)
            filepath = self.download_image(url, f"player_{player_id}.png")
            if filepath:
                return filepath

        # Try to get team logo
        team_abbrev, sport = self.detect_team(pick)
        if team_abbrev and sport == "NBA":
            # NBA logos are SVG, might need conversion
            # For now, use generic image
            pass

        # Fall back to generic sport image
        if sport:
            url = self.get_generic_sports_image(sport)
        else:
            # Detect sport from keywords
            pick_lower = pick.lower()
            detected_sport = "default"
            for sport_name, keywords in SPORT_KEYWORDS.items():
                if any(kw in pick_lower for kw in keywords):
                    detected_sport = sport_name
                    break
            url = self.get_generic_sports_image(detected_sport)

        return self.download_image(url, "generic_sports.png")

    def cleanup(self):
        """Remove temporary images"""
        import shutil
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
            os.makedirs(self.temp_dir, exist_ok=True)


def main():
    """Test the image fetcher"""
    fetcher = ImageFetcher()

    test_picks = [
        "Tyrese Maxey UNDER 10.5 Rebs + Ast @ -109",
        "Lakers -3.5 vs Celtics",
        "Chiefs ML vs Ravens"
    ]

    for pick in test_picks:
        print(f"\nPick: {pick}")

        player_id = fetcher.detect_player(pick)
        print(f"  Player ID: {player_id}")

        team, sport = fetcher.detect_team(pick)
        print(f"  Team: {team}, Sport: {sport}")

        image_path = fetcher.get_image_for_pick(pick)
        print(f"  Image path: {image_path}")

    # Cleanup
    fetcher.cleanup()


if __name__ == "__main__":
    main()
