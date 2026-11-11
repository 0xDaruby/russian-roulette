"""A terminal party game built around independent one-in-six spins."""

import random
import time


def choose(prompt, options):
    while True:
        answer = input(prompt).strip().lower()
        if answer in options:
            return answer
        print("Choose " + " or ".join(option.upper() or "Enter" for option in options) + ".")


def spin():
    print("Spinning...", flush=True)
    time.sleep(0.8)
    return random.randrange(6) != 0


def solo(high_score):
    streak = 0
    print(f"\nSolo · Session high score: {high_score}")
    input("Press Enter to spin. ")
    while spin():
        streak += 1
        print(f"Safe! Streak: {streak}")
        if choose("Enter to spin again or C to cash out: ", ("", "c")) == "c":
            print(f"You banked {streak}.")
            if streak > high_score:
                print("New high score!")
            return max(high_score, streak)
    print(f"Crash! You lost {streak} unbanked points.")
    return high_score


def elimination_round(players, starter):
    active = list(players[starter:] + players[:starter])
    while len(active) > 1:
        player = active.pop(0)
        input(f"{player}, press Enter to spin. ")
        if spin():
            print("Safe!")
            active.append(player)
        else:
            print(f"Crash! {player} is out.")
    return active[0]


def duel():
    players = ("Player 1", "Player 2")
    wins = dict.fromkeys(players, 0)
    for round_number in range(3):
        print(f"\nDuel · Round {round_number + 1}")
        winner = elimination_round(players, round_number % len(players))
        wins[winner] += 1
        print(f"{winner} wins the round. Score: {wins[players[0]]}–{wins[players[1]]}.")
        if wins[winner] == 2:
            print(f"{winner} wins the duel!")
            return


def last_one_standing():
    players = ("Player 1", "Player 2", "Player 3")
    round_number = 0
    while True:
        print(f"\nLast one standing · Round {round_number + 1}")
        winner = elimination_round(players, round_number % len(players))
        print(f"{winner} is the last one standing!")
        if choose("Enter to play another round or M for the menu: ", ("", "m")) == "m":
            return
        round_number += 1


def main():
    high_score = 0
    print("Russian Roulette")
    print("Every spin has a one-in-six chance of a crash.")
    while True:
        print("\n1. Solo\n2. Duel\n3. Last one standing\nQ. Quit")
        mode = choose("Pick a mode: ", ("1", "2", "3", "q"))
        if mode == "1":
            high_score = solo(high_score)
        elif mode == "2":
            duel()
        elif mode == "3":
            last_one_standing()
        else:
            return


if __name__ == "__main__":
    try:
        main()
    except (EOFError, KeyboardInterrupt):
        print("\nGame ended.")
