import * as ActionTypes from '../actions/actionTypes';
import resultsByGameId from '../models/results.json';
import tournamentTeams from '../models/teams.json';
import { deserializeHexPicks, getRoundForGameId, gamesByIdFromPicksById, NUM_ROUNDS } from '../utils/converters';

const teamsById = tournamentTeams.reduce((prev, curr) => {
  prev[curr.teamId] = curr;
  return prev;
 },{});

const initialState = {
  allEntries: {},
  entryCount: -1,
  displayedEntries: [],
  sortBy: 'score',
  resultsByGameId,
  searchValue: '',
};

const eliminatedTeamIds = {
  1: {},
  2: {},
  3: {},
  4: {},
  5: {},
  6: {},
};

for (let gameId in initialState.resultsByGameId) {
  const gameResult = resultsByGameId[gameId];
  const { topTeamId, bottomTeamId, winningTeamId } = gameResult;
  const losingTeam = winningTeamId === topTeamId ? bottomTeamId : topTeamId;

  const losingRound = getRoundForGameId(gameId);

  // Copy this team as being eliminated the whole way through and which round they went out in
  for (let round = losingRound; round <= NUM_ROUNDS; round++) {
    eliminatedTeamIds[round][losingTeam] = losingRound;
  }
}

initialState.eliminatedTeamIds = eliminatedTeamIds;


const scoreEntry = (entry, resultsByGameId) => {
  const picksByGameId = deserializeHexPicks(entry, teamsById);
  const gamesByGameId = gamesByIdFromPicksById(picksByGameId);
  let score = 0;
  const scoreByRound = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

  for (const gameId in resultsByGameId) {
    const round = getRoundForGameId(gameId);
    const pick = picksByGameId[gameId];
    if (pick.teamId === resultsByGameId[gameId].winningTeamId) {
      const value = 2 ** (round - 1);
      scoreByRound[round] = (scoreByRound[round] || 0) + value;
      score += value;
    }
  }

  return { score, scoreByRound, picksByGameId, gamesByGameId } ;
}

const applySort = (allEntries, sortBy, searchValue) => {
  const entriesClone = allEntries.slice(0)

  for (let i = 0; i < entriesClone.length; i++) {
    entriesClone[i] = [entriesClone[i], i];
  }

  entriesClone.sort((left, right) => {
    
    if (right[0].score === left[0].score) {
      if (resultsByGameId[62]) {
        // We have a final score and a tie
        const teamAScore = Math.max(resultsByGameId[62].topTeamScore, resultsByGameId[62].bottomTeamScore);
        const teamBScore = Math.min(resultsByGameId[62].topTeamScore, resultsByGameId[62].bottomTeamScore);
        console.log(`Finals score was ${teamAScore} - ${teamBScore}`);

        const leftTotalDifference = Math.abs(teamAScore - left[0].scoreA) + Math.abs(teamBScore - left[0].scoreB);
        const rightTotalDifference = Math.abs(teamAScore - right[0].scoreA) + Math.abs(teamBScore - right[0].scoreB);

        if (rightTotalDifference !== leftTotalDifference) {
          return leftTotalDifference - rightTotalDifference;
        }
      }

      return left[0].entryIndex - right[0].entryIndex;
    }

    return right[0].score - left[0].score
  });

  const sortedIndices = [];

  for (let j = 0; j < entriesClone.length; j++) {
    sortedIndices.push(entriesClone[j][1]);
  }
  
  const filteredIndices = sortedIndices.filter(index => {
    if (!searchValue) {
      return true;
    }
    const entry = allEntries[index];
    return entry.bracketName.toUpperCase().indexOf(searchValue.toUpperCase()) >= 0 || entry.entrant.toUpperCase().indexOf(searchValue.toUpperCase()) >= 0;
  });

  return filteredIndices;
}

const leaderboard = (state = initialState, action) => {
  switch (action.type) {
    case ActionTypes.SET_ENTRIES:
      const newState = Object.assign({}, state);
      newState.allEntries = action.entries.map(entry => {
        const { score, scoreByRound, picksByGameId, gamesByGameId } = scoreEntry(entry.picks, resultsByGameId);
        return {
          entrant: entry.entrant,
          score,
          scoreByRound,
          picksByGameId,
          gamesByGameId,
          bracketName: entry.message || '(Unnamed Bracket)',
          entryIndex: entry.entryIndex,
          scoreA: entry.scoreA,
          scoreB: entry.scoreB,
          transactionHash: entry.transactionHash,
          entryCompressed: entry.entryCompressed
        };
      });
      newState.entryCount = action.entries.length;
      newState.displayedEntries = applySort(newState.allEntries, newState.sortBy, newState.searchValue);
      return newState;
    case ActionTypes.CHANGE_SEARCH:
      return Object.assign({}, state, {
        searchValue: action.searchValue || '',
        displayedEntries: applySort(state.allEntries, state.sortBy, action.searchValue)
      })
    default:
      return state;
  }
}

export default leaderboard;