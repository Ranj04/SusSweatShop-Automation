"""
Twitter Poster - Posts tweets with images using Tweepy
"""
import tweepy
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.settings import (
    TWITTER_API_KEY,
    TWITTER_API_SECRET,
    TWITTER_ACCESS_TOKEN,
    TWITTER_ACCESS_TOKEN_SECRET
)
from typing import Optional


class TwitterPoster:
    """Posts content to Twitter using the Twitter API v2"""

    def __init__(self):
        # Set up authentication for API v1.1 (needed for media upload)
        auth = tweepy.OAuth1UserHandler(
            TWITTER_API_KEY,
            TWITTER_API_SECRET,
            TWITTER_ACCESS_TOKEN,
            TWITTER_ACCESS_TOKEN_SECRET
        )
        self.api_v1 = tweepy.API(auth)

        # Set up client for API v2 (for posting tweets)
        self.client = tweepy.Client(
            consumer_key=TWITTER_API_KEY,
            consumer_secret=TWITTER_API_SECRET,
            access_token=TWITTER_ACCESS_TOKEN,
            access_token_secret=TWITTER_ACCESS_TOKEN_SECRET
        )

    def upload_media(self, image_path: str) -> Optional[str]:
        """
        Upload media to Twitter

        Args:
            image_path: Path to the image file

        Returns:
            Media ID string or None if upload failed
        """
        if not image_path or not os.path.exists(image_path):
            print(f"Image file not found: {image_path}")
            return None

        try:
            media = self.api_v1.media_upload(filename=image_path)
            return media.media_id_string
        except tweepy.TweepyException as e:
            print(f"Error uploading media: {e}")
            return None

    def post_tweet(self, text: str, image_path: Optional[str] = None) -> Optional[dict]:
        """
        Post a tweet with optional image

        Args:
            text: Tweet text content
            image_path: Optional path to image file

        Returns:
            Tweet response data or None if posting failed
        """
        media_ids = None

        # Upload image if provided
        if image_path:
            media_id = self.upload_media(image_path)
            if media_id:
                media_ids = [media_id]

        try:
            response = self.client.create_tweet(
                text=text,
                media_ids=media_ids
            )
            print(f"Tweet posted successfully! ID: {response.data['id']}")
            return response.data
        except tweepy.TweepyException as e:
            print(f"Error posting tweet: {e}")
            return None

    def post_thread(self, tweets: list, image_paths: Optional[list] = None) -> list:
        """
        Post a thread of tweets

        Args:
            tweets: List of tweet texts
            image_paths: Optional list of image paths (one per tweet, use None for no image)

        Returns:
            List of tweet response data
        """
        if image_paths is None:
            image_paths = [None] * len(tweets)

        responses = []
        reply_to_id = None

        for i, (text, image_path) in enumerate(zip(tweets, image_paths)):
            media_ids = None

            # Upload image if provided
            if image_path:
                media_id = self.upload_media(image_path)
                if media_id:
                    media_ids = [media_id]

            try:
                if reply_to_id:
                    response = self.client.create_tweet(
                        text=text,
                        media_ids=media_ids,
                        in_reply_to_tweet_id=reply_to_id
                    )
                else:
                    response = self.client.create_tweet(
                        text=text,
                        media_ids=media_ids
                    )

                responses.append(response.data)
                reply_to_id = response.data['id']
                print(f"Tweet {i+1} posted! ID: {reply_to_id}")

            except tweepy.TweepyException as e:
                print(f"Error posting tweet {i+1}: {e}")
                break

        return responses

    def verify_credentials(self) -> bool:
        """
        Verify that Twitter credentials are working

        Returns:
            True if credentials are valid
        """
        try:
            user = self.api_v1.verify_credentials()
            print(f"Authenticated as: @{user.screen_name}")
            return True
        except tweepy.TweepyException as e:
            print(f"Authentication failed: {e}")
            return False


def main():
    """Test the Twitter poster"""
    poster = TwitterPoster()

    # Verify credentials
    print("Verifying Twitter credentials...")
    if poster.verify_credentials():
        print("Credentials verified!")

        # Optional: Post a test tweet (commented out to prevent accidental posting)
        # test_tweet = "Testing SUSSWEATSHOP bot - please ignore!"
        # result = poster.post_tweet(test_tweet)
        # if result:
        #     print(f"Test tweet posted: {result}")
    else:
        print("Failed to verify credentials. Check your API keys.")


if __name__ == "__main__":
    main()
