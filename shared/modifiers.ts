export interface Modifier {
  id: string;
  name: string;
  nameAr?: string;
  category: "spymaster" | "board" | "guesser";
  categoryAr?: string;
  description: string;
  descriptionAr?: string;
  icon: string; // matches the Lucide icon name to render on client
}

export const MODIFIERS: Modifier[] = [
  {
    id: "off-by-one",
    name: "Off-By-One Error",
    nameAr: "خطأ الإزاحة بواحد",
    category: "spymaster",
    description:
      "The Spymaster must give a clue number that is exactly +1 or -1 of their intended target. (e.g. if the target is 2, type 1 or 3).",
    descriptionAr:
      "يجب على رئيس الجواسيس إعطاء رقم دليل بزيادة أو نقصان واحد بالضبط عن هدفه المقصود. (مثلاً: إذا كان الهدف 2، اكتب 1 أو 3).",
    icon: "Binary",
  },
  {
    id: "vowel-void",
    name: "Vowel Void",
    nameAr: "تجنب أحرف العلة",
    category: "spymaster",
    description:
      "The Spymaster's clue cannot contain the letters 'A' or 'E' (case-insensitive). Any 'A' or 'E' entered will be stripped upon submission!",
    descriptionAr:
      'لا يمكن أن يحتوي دليل رئيس الجواسيس على أحرف العلة "A" أو "E" (أو أي حرف علة محدد). سيتم مسح أي حرف من هذه الأحرف عند الإرسال!',
    icon: "FileText",
  },
  {
    id: "oracle-riddle",
    name: "The Oracle's Riddle",
    nameAr: "لغز العراف",
    category: "spymaster",
    description:
      'The Spymaster must give a two-word clue, and the two words must be an exact rhyming pair (e.g., "Red Bed", "Tall Wall"). Spaces are allowed.',
    descriptionAr:
      "يجب على رئيس الجواسيس تقديم دليل مكون من كلمتين، ويجب أن تكون الكلمتان متوافقتين في القافية تماماً. يُسمح باستخدام المسافات.",
    icon: "HelpCircle",
  },
  {
    id: "sensory-deprivation",
    name: "Sensory Deprivation",
    nameAr: "الحرمان الحسي",
    category: "board",
    description:
      "The board colors are hidden during the guessing phase! They only briefly reveal for 3 seconds when the Spymaster submits a clue.",
    descriptionAr:
      "ألوان اللوحة مخفية أثناء مرحلة التخمين! تظهر فقط لفترة وجيزة لمدة 3 ثوانٍ عندما يقدم رئيس الجواسيس دليلاً.",
    icon: "EyeOff",
  },
  {
    id: "dimensional-scramble",
    name: "Dimensional Scramble",
    nameAr: "خلط الأبعاد",
    category: "board",
    description:
      "Chaos! Three random unrevealed cards have swapped positions in the grid layout.",
    descriptionAr:
      "فوضى! ثلاث بطاقات عشوائية غير مكشوفة تبادلت مواقعها في تخطيط الشبكة.",
    icon: "Shuffle",
  },
  {
    id: "scrambled-comms",
    name: "Forced Anagram",
    nameAr: "الجناس الإجباري",
    category: "board",
    description:
      "All words on the board are anagrammed (letters shuffled) for the guessers until they click to reveal them.",
    descriptionAr:
      "يتم خلط حروف جميع الكلمات الموجودة على اللوحة بالنسبة للمخمنين حتى ينقروا عليها للكشف عنها.",
    icon: "SpellCheck",
  },
  {
    id: "the-mimic",
    name: "The Mimic",
    nameAr: "المقلد",
    category: "board",
    description:
      "Secret danger! One random unrevealed Neutral card acts as the Assassin for this turn only.",
    descriptionAr:
      "خطر سري! بطاقة محايدة واحدة غير مكشوفة تعمل كقاتل لهذا الدور فقط.",
    icon: "Skull",
  },
  {
    id: "eroding-parchment",
    name: "Eroding Parchment",
    nameAr: "الورق المتآكل",
    category: "guesser",
    description:
      "The text on unrevealed cards slowly blurs and fades away over 20 seconds during the guessing phase. Act fast!",
    descriptionAr:
      "النص على البطاقات غير المكشوفة يتلاشى تدريجياً خلال 20 ثانية أثناء مرحلة التخمين. تصرف بسرعة!",
    icon: "Wind",
  },
  {
    id: "critical-hit",
    name: "Critical Hit",
    nameAr: "ضربة حرجة",
    category: "guesser",
    description:
      "Pauses the turn timer! If the guessing team clicks their first correct card within 5 seconds of clue submission, the countdown stops.",
    descriptionAr:
      "يوقف مؤقت الدور! إذا نقر الفريق المخمن على بطاقته الصحيحة الأولى في غضون 5 ثوانٍ من إرسال الدليل، يتوقف العد التنازلي.",
    icon: "Zap",
  },
  {
    id: "blood-pact",
    name: "Blood Pact",
    nameAr: "ميثاق الدم",
    category: "guesser",
    description:
      'Click "Blood Pact" to safely reveal one card color. Once used, your turn is hard-capped to exactly one standard guess afterward.',
    descriptionAr:
      'انقر على "ميثاق الدم" للكشف عن لون بطاقة واحدة بأمان. بمجرد استخدامه، يقتصر دورك على تخمين واحد قياسي فقط بعد ذلك.',
    icon: "HeartHandshake",
  },
  {
    id: "gacha-pull",
    name: "Gacha Pull",
    nameAr: "سحب جاتشا",
    category: "guesser",
    description:
      'Leverage pure chance! Click "Pull Lever" to randomly select and reveal an unrevealed card on the board.',
    descriptionAr:
      'استفد من الصدفة البحتة! انقر على "سحب الرافعة" لاختيار بطاقة غير مكشوفة على اللوحة والكشف عنها بشكل عشوائي.',
    icon: "Gift",
  },
  {
    id: "shield-wall",
    name: "Shield Wall",
    nameAr: "جدار الدرع",
    category: "guesser",
    description:
      'Lock a card down! Click "Lock Card" and select any card to disable guesses on it for the next 2 turns.',
    descriptionAr:
      'أغلق بطاقة! انقر على "قفل البطاقة" وحدد أي بطاقة لتعطيل التخمينات عليها خلال الدورتين القادمتين.',
    icon: "Shield",
  },
  {
    id: "slippery-fingers",
    name: "Slippery Fingers",
    nameAr: "أصابع زلقة",
    category: "guesser",
    description:
      "Precision is thrown out the window. When a guesser attempts to click a card on the board, there is a 25% chance their mouse slips. Instead of revealing the card they clicked, the system intercepts it and reveals a completely random adjacent card.",
    descriptionAr:
      "يتم التخلي عن الدقة. عندما يحاول المخمن النقر على بطاقة على اللوحة، هناك فرصة 25٪ أن تنزلق فأرته. بدلاً من الكشف عن البطاقة التي نقر عليها، يعترضها النظام ويكشف عن بطاقة مجاورة عشوائية تماماً.",
    icon: "MousePointer2",
  },
  {
    id: "lag-spike",
    name: "Lag Spike",
    nameAr: "تأخر الشبكة",
    category: "guesser",
    description:
      "Forced network delay! Operatives are locked out of guessing for 15 seconds at the start of the turn.",
    descriptionAr:
      "تأخير قسري في الشبكة! يُمنع العملاء من التخمين لمدة 15 ثانية في بداية الدور.",
    icon: "WifiOff",
  },
  {
    id: "haste",
    name: "Haste",
    nameAr: "سرعة",
    category: "guesser",
    description:
      "Turn time limit is slashed in half for the guessing phase! Move quickly!",
    descriptionAr:
      "يتم تقليص الحد الزمني للدور إلى النصف لمرحلة التخمين! تحرك بسرعة!",
    icon: "Timer",
  },
  {
    id: "five-letter-curse",
    name: "The Five-Letter Curse",
    nameAr: "لعنة الخمسة أحرف",
    category: "spymaster",
    description:
      "The Spymaster’s clue must be exactly five letters long. No more, no less.",
    descriptionAr:
      "يجب أن يتكون دليل رئيس الجواسيس من خمسة أحرف بالضبط. لا أكثر ولا أقل.",
    icon: "Type",
  },
  {
    id: "colorblind",
    name: "Colorblind",
    nameAr: "عمى الألوان",
    category: "board",
    description:
      "Spymasters are suddenly colorblind. Spymasters see cards of their own team's color as the opposite team's color, and the opposite team's color as their own team's color. (Classic only)",
    descriptionAr:
      "رؤساء الجواسيس مصابون بالعمى اللوني فجأة. يرى رؤساء الجواسيس بطاقات ألوان فرقهم على أنها ألوان الفرق الأخرى، وألوان الفرق الأخرى على أنها ألوان فرقهم. (للكلاسيكي فقط)",
    icon: "Palette",
  },
  {
    id: "d20-roll",
    name: "Baldur's Gate (D20)",
    nameAr: "نرد بوابة الاصلع",
    category: "spymaster",
    description:
      "Roll a D20! Roll 1: Skip turn. Roll 20: Free reveal. Roll 2-19: Normal turn.",
    descriptionAr:
      "ارمي نرد D20! رمية 1: تخطي الدور. رمية 20: كشف مجاني. رمية 2-19: دور عادي.",
    icon: "Dices",
  },
  {
    id: "the-intercept",
    name: "The Intercept",
    nameAr: "الاعتراض",
    category: "guesser",
    description:
      "After a clue is given, the enemy team has 5 seconds to guess one of the active team's cards. A correct guess reveals that card (the active team gets the point) but skips the active team's turn. A wrong guess doesn't reveal any card but skips the enemy team's own next turn as a penalty. (Classic only)",
    descriptionAr:
      "بعد إعطاء الدليل، يملك فريق العدو 5 ثوانٍ لتخمين بطاقة من بطاقات الفريق النشط. إذا أصابوا، تُكشف البطاقة (يحصل الفريق النشط على النقطة) ويُتخطى دوره. إذا أخطأوا، لا تُكشف أي بطاقة ويُتخطى دور فريق العدو القادم كعقوبة. (للكلاسيكي فقط)",
    icon: "Crosshair",
  },
  {
    id: "mutiny",
    name: "Mutiny",
    nameAr: "تمرد",
    category: "guesser",
    description:
      "The guessers can reject the Spymaster's clue once. The Spymaster must submit a new one, but the team loses their bonus guess.",
    descriptionAr:
      "يمكن للمخمنين رفض دليل رئيس الجواسيس مرة واحدة. يجب على رئيس الجواسيس تقديم دليل جديد، لكن الفريق يفقد تخمينه الإضافي.",
    icon: "Swords",
  },
  {
    id: "lost-in-translation",
    name: "Lost in Translation",
    nameAr: "ضائع في الترجمة",
    category: "board",
    description:
      "The entire board suddenly switches languages! English translates to Arabic, and vice versa.",
    descriptionAr:
      "تتحول اللوحة بأكملها فجأة إلى لغة مختلفة! تترجم الإنجليزية إلى العربية والعكس.",
    icon: "Globe",
  },
  {
    id: "marquee-madness",
    name: "Marquee Madness",
    nameAr: "جنون اللوحة المتحركة",
    category: "board",
    description:
      "The text on unrevealed cards continuously scrolls off the edge and loops back.",
    descriptionAr:
      "النص الموجود على البطاقات غير المكشوفة يمرر باستمرار خارج الحافة ويعود مرة أخرى.",
    icon: "FastForward",
  },
  {
    id: "earthquake",
    name: "Earthquake",
    nameAr: "زلزال",
    category: "board",
    description:
      "Every unrevealed card on the board randomly shuffles to a new position.",
    descriptionAr:
      "تنتقل كل بطاقة غير مكشوفة على اللوحة عشوائياً إلى موقع جديد.",
    icon: "Activity",
  },
  {
    id: "censored-documents",
    name: "Censored Documents",
    nameAr: "وثائق خاضعة للرقابة",
    category: "board",
    description:
      "Random letters in every unrevealed word are redacted with asterisks (*).",
    descriptionAr:
      "يتم حجب أحرف عشوائية في كل كلمة غير مكشوفة بعلامات النجمة (*).",
    icon: "Scissors",
  },
  {
    id: "fog-of-war",
    name: "Fog of War",
    nameAr: "ضباب الحرب",
    category: "board",
    description:
      "A dense fog obscures the board. Hovering over a card reveals it, but you can only see one card at a time.",
    descriptionAr:
      "ضباب كثيف يحجب اللوحة. يؤدي التمرير فوق البطاقة إلى كشفها، ولكن لا يمكنك رؤية سوى بطاقة واحدة في كل مرة.",
    icon: "CloudFog",
  },
  {
    id: "hall-of-mirrors",
    name: "Hall of Mirrors",
    nameAr: "قاعة المرايا",
    category: "board",
    description:
      "Two unrevealed cards on the board suddenly have their text replaced with the exact same word.",
    descriptionAr:
      "بطاقتان غير مكشوفة على اللوحة يتم استبدال نصها فجأة بنفس الكلمة تماماً.",
    icon: "Copy",
  },
  {
    id: "poltergeist",
    name: "Poltergeist",
    nameAr: "روح شريرة",
    category: "board",
    description: "Exactly half of the unrevealed cards flip upside down.",
    descriptionAr: "نصف البطاقات غير المكشوفة ينقلب رأساً على عقب.",
    icon: "Ghost",
  },
  {
    id: "forced-acronym",
    name: "Forced Acronym",
    nameAr: "اختصار إجباري",
    category: "spymaster",
    description:
      "The game randomly assigns a 3-letter sequence to the Spymaster. The Spymaster is required to provide a 3-word clue where the starting letters of each word perfectly match the sequence in order.",
    descriptionAr:
      "تُعين اللعبة تسلسلاً عشوائياً من 3 أحرف لمدير الشبكة. يُطلب منه تقديم دليل مكون من 3 كلمات حيث تتطابق الأحرف الأولى لكل كلمة تماماً مع التسلسل بالترتيب.",
    icon: "CaseUpper",
  },
  {
    id: "the-dictator",
    name: "The Dictator",
    nameAr: "الدكتاتور",
    category: "spymaster",
    description:
      "The Spymaster does not get to choose their clue number. The system violently forces the number dropdown to a random, usually aggressive number and locks it.",
    descriptionAr:
      "لا يحق لرئيس الجواسيس اختيار رقم الدليل الخاص به. يفرض النظام بعنف رقم عشوائي (غالباً ما يكون كبيراً) ويغلق القائمة المنسدلة.",
    icon: "Lock",
  },
  {
    id: "boolean-search",
    name: "Boolean Search",
    nameAr: "بحث منطقي",
    category: "spymaster",
    description:
      "The Spymaster must construct their clue using exactly one logical operator: AND, OR, or NOT.",
    descriptionAr:
      "يجب على رئيس الجواسيس بناء دليله باستخدام معامل منطقي واحد بالضبط: AND أو OR أو NOT.",
    icon: "Terminal",
  },
];

export function checkRhyme(
  word1: string,
  word2: string,
  isArabic: boolean,
): boolean {
  const w1 = word1.toLowerCase().trim();
  const w2 = word2.toLowerCase().trim();

  if (w1 === w2) return false;
  if (w1.length === 0 || w2.length === 0) return false;

  if (isArabic) {
    const minLen = Math.min(w1.length, w2.length);
    const matchLen = minLen >= 3 ? 2 : 1;
    return w1.slice(-matchLen) === w2.slice(-matchLen);
  }

  const getRhymeSuffix = (word: string) => {
    const isVowel = (char: string) => /[aeiouy]/.test(char);

    let endIdx = word.length - 1;
    if (word.endsWith("e") && word.length > 2) {
      let hasOtherVowel = false;
      for (let i = 0; i < word.length - 1; i++) {
        if (isVowel(word[i])) {
          hasOtherVowel = true;
          break;
        }
      }
      if (hasOtherVowel) {
        endIdx = word.length - 2;
      }
    }

    let lastVowelIdx = -1;
    for (let i = endIdx; i >= 0; i--) {
      if (isVowel(word[i])) {
        lastVowelIdx = i;
        break;
      }
    }

    if (lastVowelIdx === -1) {
      return word.slice(-2);
    }

    let startOfCluster = lastVowelIdx;
    while (startOfCluster > 0 && isVowel(word[startOfCluster - 1])) {
      startOfCluster--;
    }

    return word.slice(startOfCluster);
  };

  const suffix1 = getRhymeSuffix(w1);
  const suffix2 = getRhymeSuffix(w2);

  if (suffix1 === suffix2) return true;

  const matchLen = Math.min(w1.length, w2.length, 2);
  if (w1.slice(-matchLen) === w2.slice(-matchLen)) return true;

  return false;
}
