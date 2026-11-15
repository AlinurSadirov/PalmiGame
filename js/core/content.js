/* Palmi — учебный контент: слова, острова, уровни, диалоги жителей. */
(function (root) {
  'use strict';

  // Порядок слов = порядок изучения
  const WORDS = {
    HELLO: { en: 'HELLO', ru: 'Привет', hint: 'Ладонь прямая, пальцы вместе, большой прижат. Коснись виска и отведи руку вперёд — как отдаёшь честь.' },
    YES: { en: 'YES', ru: 'Да', hint: 'Сожми кулак, большой палец лежит поверх пальцев. Кивни кулаком вверх-вниз.' },
    NO: { en: 'NO', ru: 'Нет', hint: 'Указательный и средний пальцы сомкни с большим — как клюв. Безымянный и мизинец прижаты.' },
    GOODBYE: { en: 'GOODBYE', ru: 'Пока', hint: 'Раскрытая ладонь, пальцы вместе. Сгибай пальцы в основании вниз-вверх, будто машешь «пока».' },
    HOW_ARE_YOU: { en: 'HOW ARE YOU', ru: 'Как дела?', hint: 'HOW: согнутые кисти тыльной стороной вместе, поверни ладонями вверх. YOU: укажи указательным пальцем на собеседника. Камера проверяет YOU.' },
    I_AM_FINE: { en: 'I AM FINE', ru: 'У меня всё хорошо', hint: 'Раскрой ладонь, пальцы разведены (форма «5»). Коснись большим пальцем груди.' },
    GOOD_LUCK: { en: 'GOOD LUCK', ru: 'Удачи', hint: 'Кулак, большой палец смотрит вверх. Подай руку немного вперёд.' },
    SEE_YOU: { en: 'SEE YOU', ru: 'Увидимся', hint: 'Пальцы V у глаз, затем направь их вперёд — на собеседника.' },
    EAT: { en: 'EAT', ru: 'Есть (кушать)', hint: 'Собери все пальцы щепоткой к большому и поднеси к губам.' },
    DRINK: { en: 'DRINK', ru: 'Пить', hint: 'Согни пальцы буквой C, будто держишь стакан, и наклони его к губам.' },
    WATER: { en: 'WATER', ru: 'Вода', hint: 'Три пальца подняты (буква W), большой прижимает мизинец. Коснись подбородка.' },
    PHONE: { en: 'PHONE', ru: 'Телефон', hint: 'Большой палец и мизинец в стороны (буква Y), остальные согнуты. Поднеси к уху.' },
    I_LOVE_YOU: { en: 'I LOVE YOU', ru: 'Я тебя люблю', hint: 'Подними большой, указательный и мизинец. Средний и безымянный прижми к ладони.' },
  };

  // Сложность: порог уверенности ИИ, подсказки, время на жест, сколько секунд держать жест
  const DIFFICULTY = {
    beginner: { label: 'Beginner', threshold: 0.7, autoHint: true, showRu: true, timeLimit: 20, hold: 0.9 },
    intermediate: { label: 'Intermediate', threshold: 0.8, autoHint: false, showRu: true, timeLimit: 16, hold: 1.0 },
    advanced: { label: 'Advanced', threshold: 0.85, autoHint: false, showRu: false, timeLimit: 13, hold: 1.1, speedBonus: 7 },
  };

  // Предложения: сначала собрать из слов, потом показать жестами (обязательное задание)
  const SENTENCES = {
    howAreYou: { words: ['HELLO', 'HOW_ARE_YOU'], ru: 'Привет, как дела?' },
    fine: { words: ['I_AM_FINE', 'SEE_YOU'], ru: 'У меня всё хорошо, увидимся!' },
    luck: { words: ['GOODBYE', 'GOOD_LUCK'], ru: 'Пока, удачи!' },
    yesFine: { words: ['YES', 'I_AM_FINE'], ru: 'Да, у меня всё хорошо.' },
    full: { words: ['HELLO', 'HOW_ARE_YOU', 'GOOD_LUCK'], ru: 'Привет! Как дела? Удачи!' },
    lunch: { words: ['HELLO', 'EAT'], ru: 'Привет, пойдём есть!' },
    call: { words: ['GOODBYE', 'PHONE'], ru: 'Пока, позвони мне!' },
  };

  const DIALOGS = {
    greet: [
      { npc: 'pip', en: 'Hi! Nice to meet you!', ru: 'Привет! Рада познакомиться!', answer: 'HELLO' },
      { npc: 'pip', en: 'Do you like our island?', ru: 'Тебе нравится наш остров?', answer: 'YES' },
      { npc: 'pip', en: 'Is it raining today?', ru: 'Сегодня идёт дождь?', answer: 'NO' },
      { npc: 'pip', en: 'I have to go now. Bye!', ru: 'Мне пора. Пока!', answer: 'GOODBYE' },
    ],
    talk: [
      { npc: 'pip', en: 'Hello! How are you?', ru: 'Привет! Как дела?', answer: 'I_AM_FINE' },
      { npc: 'pip', en: 'I have an exam tomorrow.', ru: 'У меня завтра экзамен.', answer: 'GOOD_LUCK' },
      { npc: 'pip', en: 'Ask me how I am.', ru: 'Спроси, как у меня дела.', answer: 'HOW_ARE_YOU' },
      { npc: 'pip', en: 'I am leaving. Will we meet again?', ru: 'Я ухожу. Мы ещё встретимся?', answer: 'SEE_YOU' },
    ],
    kitchen: [
      { npc: 'tori', en: 'The soup is ready. What do we do now?', ru: 'Суп готов. Что теперь делаем?', answer: 'EAT' },
      { npc: 'tori', en: 'It is very hot. What do you need?', ru: 'Очень жарко. Что тебе нужно?', answer: 'WATER' },
      { npc: 'tori', en: 'Here is a cup of tea for you.', ru: 'Вот тебе чашка чая.', answer: 'DRINK' },
      { npc: 'tori', en: 'Are you hungry?', ru: 'Ты голоден?', answer: 'YES' },
    ],
    harbor: [
      { npc: 'tori', en: 'Your mom is calling. Take the…', ru: 'Мама звонит. Возьми…', answer: 'PHONE' },
      { npc: 'pip', en: 'What do you say to your best friend?', ru: 'Что ты скажешь лучшему другу?', answer: 'I_LOVE_YOU' },
      { npc: 'tori', en: 'Do you want more water?', ru: 'Хочешь ещё воды?', answer: 'NO' },
      { npc: 'tori', en: 'The ship is leaving. Say bye!', ru: 'Корабль уходит. Попрощайся!', answer: 'GOODBYE' },
    ],
  };

  // Уровень: words — новые слова, review — повторение, sentences — обязательные предложения, mode — особые правила
  const ISLANDS = [
    {
      id: 'greet', name: 'Остров Приветствий', short: 'Приветствия', difficulty: 'beginner', premium: false, npc: 'pip',
      levels: [
        { id: 'greet-1', name: 'Первые слова', words: ['HELLO', 'YES'] },
        { id: 'greet-2', name: 'Да и нет', words: ['NO'], review: ['HELLO', 'YES'] },
        { id: 'greet-3', name: 'До встречи', words: ['GOODBYE'], review: ['HELLO', 'NO'], dialogs: 'greet' },
        { id: 'greet-4', name: 'Испытание острова', words: [], review: ['HELLO', 'GOODBYE', 'YES', 'NO'], mode: 'challenge', dialogs: 'greet' },
      ],
    },
    {
      id: 'talk', name: 'Бухта Разговоров', short: 'Разговор', difficulty: 'beginner', premium: false, npc: 'pip',
      levels: [
        { id: 'talk-1', name: 'Как дела?', words: ['HOW_ARE_YOU', 'I_AM_FINE'], review: ['HELLO'], sentences: ['howAreYou'] },
        { id: 'talk-2', name: 'Удачи!', words: ['GOOD_LUCK'], review: ['GOODBYE', 'I_AM_FINE'], sentences: ['luck'] },
        { id: 'talk-3', name: 'Увидимся', words: ['SEE_YOU'], review: ['HOW_ARE_YOU', 'GOODBYE'], sentences: ['fine'], dialogs: 'talk' },
        { id: 'talk-4', name: 'Испытание бухты', words: [], review: ['HOW_ARE_YOU', 'I_AM_FINE', 'GOOD_LUCK', 'SEE_YOU', 'GOODBYE'], mode: 'challenge', sentences: ['full', 'yesFine'], dialogs: 'talk' },
      ],
    },
    {
      id: 'kitchen', name: 'Кухня Деревни', short: 'Еда', difficulty: 'intermediate', premium: false, npc: 'tori',
      levels: [
        { id: 'kitchen-1', name: 'Обед', words: ['EAT', 'DRINK'], review: ['YES'] },
        { id: 'kitchen-2', name: 'Глоток воды', words: ['WATER'], review: ['DRINK', 'NO'], phrases: [['DRINK', 'WATER']] },
        { id: 'kitchen-3', name: 'Разговор с Тори', words: [], review: ['EAT', 'DRINK', 'WATER', 'YES'], dialogs: 'kitchen' },
        { id: 'kitchen-4', name: 'Испытание кухни', words: [], review: ['EAT', 'DRINK', 'WATER', 'GOOD_LUCK', 'HELLO'], mode: 'challenge', sentences: ['lunch'], dialogs: 'kitchen' },
      ],
    },
    {
      id: 'harbor', name: 'Гавань Связи', short: 'Связь', difficulty: 'advanced', premium: true, npc: 'tori',
      levels: [
        { id: 'harbor-1', name: 'Звонок', words: ['PHONE', 'I_LOVE_YOU'], review: ['HELLO'] },
        { id: 'harbor-2', name: 'Голоса гавани', words: [], review: ['PHONE', 'I_LOVE_YOU', 'NO', 'SEE_YOU'], dialogs: 'harbor', sentences: ['call'] },
        { id: 'harbor-3', name: 'Испытание гавани', words: [], review: ['PHONE', 'WATER', 'EAT', 'I_LOVE_YOU', 'HOW_ARE_YOU'], mode: 'challenge', dialogs: 'harbor' },
      ],
    },
    {
      id: 'summit', name: 'Гора Мастеров', short: 'Мастер', difficulty: 'advanced', premium: true, npc: 'pip',
      levels: [
        { id: 'summit-1', name: 'Быстрые руки', words: [], review: ['HELLO', 'GOODBYE', 'YES', 'NO', 'GOOD_LUCK', 'SEE_YOU'], mode: 'speed' },
        { id: 'summit-2', name: 'Все слова', words: [], review: Object.keys(WORDS), mode: 'speed', phrases: [['I_LOVE_YOU', 'YES'], ['NO', 'DRINK']] },
        { id: 'summit-3', name: 'Вершина', words: [], review: Object.keys(WORDS), mode: 'challenge', dialogs: 'harbor', sentences: ['full'] },
      ],
    },
  ];

  const ACHIEVEMENTS = [
    { id: 'first-word', name: 'Первое слово', desc: 'Покажи первый жест правильно' },
    { id: 'first-level', name: 'Первый шаг', desc: 'Пройди первый уровень' },
    { id: 'perfect', name: 'Без единой ошибки', desc: 'Пройди уровень на 3 звезды' },
    { id: 'streak-3', name: 'Три дня подряд', desc: 'Занимайся 3 дня подряд' },
    { id: 'streak-7', name: 'Неделя с Palmi', desc: 'Занимайся 7 дней подряд' },
    { id: 'fix-5', name: 'Работа над ошибками', desc: 'Исправь 5 ошибок в тренировке' },
    { id: 'words-7', name: 'Полиглот', desc: 'Выучи 7 слов' },
    { id: 'words-all', name: 'Весь словарь', desc: 'Выучи все 13 слов' },
    { id: 'island-greet', name: 'Друг острова', desc: 'Пройди Остров Приветствий' },
    { id: 'island-talk', name: 'Душа компании', desc: 'Пройди Бухту Разговоров' },
    { id: 'sentences-3', name: 'Мастер фраз', desc: 'Составь и покажи 3 предложения' },
    { id: 'island-kitchen', name: 'Шеф-повар', desc: 'Пройди Кухню Деревни' },
    { id: 'calibrated', name: 'Своя рука', desc: 'Откалибруй ИИ под себя (5 жестов)' },
  ];

  const PREMIUM = {
    monthly: { label: 'Месяц', price: 1490, note: '' },
    yearly: { label: 'Год', price: 11990, note: 'выгода 33%' },
    trialDays: 7,
    freeDetailedPerDay: 1,
  };

  const api = { WORDS, DIFFICULTY, SENTENCES, DIALOGS, ISLANDS, ACHIEVEMENTS, PREMIUM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Palmi = root.Palmi || {};
  root.Palmi.Content = api;
})(typeof window !== 'undefined' ? window : globalThis);
