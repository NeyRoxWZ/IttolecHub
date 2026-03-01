-- Cleanup script to remove tables associated with deleted games
-- Games: RimGuessr (Rhyme), PriceGuessr, PopulationGuessr, LyricsGuessr, CalorieGuessr

-- RhymeGuessr
DROP TABLE IF EXISTS rhyme_games CASCADE;
DROP TABLE IF EXISTS rhyme_players CASCADE;
DROP TABLE IF EXISTS rhymeguessr_games CASCADE;
DROP TABLE IF EXISTS rhymeguessr_players CASCADE;

-- PriceGuessr
DROP TABLE IF EXISTS price_games CASCADE;
DROP TABLE IF EXISTS price_players CASCADE;
DROP TABLE IF EXISTS priceguessr_games CASCADE;
DROP TABLE IF EXISTS priceguessr_players CASCADE;

-- PopulationGuessr
DROP TABLE IF EXISTS population_games CASCADE;
DROP TABLE IF EXISTS population_players CASCADE;
DROP TABLE IF EXISTS populationguessr_games CASCADE;
DROP TABLE IF EXISTS populationguessr_players CASCADE;

-- LyricsGuessr
DROP TABLE IF EXISTS lyrics_games CASCADE;
DROP TABLE IF EXISTS lyrics_players CASCADE;
DROP TABLE IF EXISTS lyricsguessr_games CASCADE;
DROP TABLE IF EXISTS lyricsguessr_players CASCADE;

-- CalorieGuessr
DROP TABLE IF EXISTS calorie_games CASCADE;
DROP TABLE IF EXISTS calorie_players CASCADE;
DROP TABLE IF EXISTS calories_games CASCADE;
DROP TABLE IF EXISTS calories_players CASCADE;
DROP TABLE IF EXISTS caloriesguessr_games CASCADE;
DROP TABLE IF EXISTS caloriesguessr_players CASCADE;
DROP TABLE IF EXISTS food_games CASCADE;
DROP TABLE IF EXISTS food_players CASCADE;

-- Clean up publications if necessary (Supabase handles this usually via CASCADE, but good to be safe)
-- alter publication supabase_realtime drop table if exists ...
