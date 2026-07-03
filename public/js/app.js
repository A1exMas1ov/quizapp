(async function() {
  await AuthStore.load();

  Router
    .on('/', () => HomePage.render())
    .on('/auth', ({ query }) => AuthPage.render(query))
    .on('/dashboard', () => DashboardOrganizerPage.render())
    .on('/org-history', () => OrgHistoryPage.render())
    .on('/my-quizzes', () => DashboardParticipantPage.render())
    .on('/quiz/:id/edit', ({ params }) => QuizBuilderPage.render(params))
    .on('/quiz/new', ({ params }) => QuizBuilderPage.render(params))
    .on('/host/:id', ({ params }) => LobbyOrganizerPage.render(params))
    .on('/host-question/:id', ({ params }) => HostQuestionPage.render(params))
    .on('/lobby/:id', ({ params }) => LobbyParticipantPage.render(params))
    .on('/play/:id', ({ params }) => PlayQuestionPage.render(params))
    .on('/final/:id', ({ params }) => FinalResultsPage.render(params));

  Router.start();
})();
