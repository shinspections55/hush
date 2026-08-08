import json

# Load players.json
with open(r"c:\Users\ampbo\Website\players.json", 'r', encoding='utf-8') as f:
    players = json.load(f)

# Remove cpuMinPrice and cpuMaxPrice from each player
for player in players:
    if 'cpuMinPrice' in player:
        del player['cpuMinPrice']
    if 'cpuMaxPrice' in player:
        del player['cpuMaxPrice']

# Save back
with open(r"c:\Users\ampbo\Website\players.json", 'w', encoding='utf-8') as f:
    json.dump(players, f, indent=4, ensure_ascii=False)

print("Removed cpuMinPrice and cpuMaxPrice from players.json")