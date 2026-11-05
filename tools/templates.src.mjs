// Source of server/templates.json. Edit here (or edit the JSON directly / supply TEMPLATES_URL) to add new trends.
// Names: "en|ru|uk|es|pt|de|fr|tr|ar|hi|id"
import fs from 'fs';
const L = ['en', 'ru', 'uk', 'es', 'pt', 'de', 'fr', 'tr', 'ar', 'hi', 'id'];
const tr = s => Object.fromEntries(s.split('|').map((v, i) => [L[i], v.trim()]));
const T = [];
const add = (id, kind, group, emoji, scene, o, names, prompt) => T.push({ id, kind, group, emoji, scene, ...o, name: tr(names), prompt });

// 🔥 Viral now (Nov 2026 TikTok/Reels formats, generic names)
add('v_flamingo', 'video', 'viral', '🦩', 'pool', { motion: 'float', music: 'summer', faces: 1, hot: true, isNew: true },
  'Flamingo pool fail|Фламинго в бассейне|Фламінго в басейні|Flamenco en la piscina|Flamingo na piscina|Flamingo-Pool-Fail|Flamant rose à la piscine|Flamingo havuz|فلامنغو المسبح|फ्लेमिंगो पूल|Flamingo di kolam',
  'the person relaxing on a pink flamingo pool float in a rooftop infinity pool above a city, waves at camera cheerfully, then the float slowly slips over the glass edge, funny, 9:16');
add('v_2027', 'video', 'viral', '🎆', 'year2027', { motion: 'climb', music: 'epic', faces: 1, hot: true, isNew: true, title: tr('Hello 2027!|Привет, 2027!|Привіт, 2027!|¡Hola 2027!|Olá 2027!|Hallo 2027!|Bonjour 2027 !|Merhaba 2027!|مرحبا 2027!|हैलो 2027!|Halo 2027!') },
  'Goodbye 2026, hello 2027|Пока 2026, привет 2027|Бувай 2026, привіт 2027|Adiós 2026, hola 2027|Tchau 2026, olá 2027|Tschüss 2026, hallo 2027|Adieu 2026, bonjour 2027|Elveda 2026, merhaba 2027|وداعا 2026 مرحبا 2027|अलविदा 2026, हैलो 2027|Dah 2026, halo 2027',
  'the person climbing onto a giant white marble 2027 sculpture on a mountain peak above the clouds at sunrise, fireworks, triumphant, cinematic');
add('v_entrance', 'video', 'viral', '🚪', 'barber', { motion: 'strut', music: 'funk', faces: 1, hot: true },
  'Epic entrance walk|Эффектный вход|Ефектний вхід|Entrada épica|Entrada épica|Epischer Auftritt|Entrée épique|Efsane giriş|دخول أسطوري|धमाकेदार एंट्री|Masuk keren',
  'someone holds the barbershop door open and the person struts in with an over-the-top slow, low cool walk, dipping down and rising up, funny, slow motion');
add('v_zombie', 'video', 'viral', '🧟', 'zombie', { motion: 'shock', music: 'drama', faces: 1, filter: 'zombie', hot: true, title: tr('Still love me?|Всё ещё любишь?|Досі кохаєш?|¿Aún me quieres?|Ainda me ama?|Liebst du mich noch?|Tu m\'aimes encore ?|Hâlâ seviyor musun?|هل ما زلت تحبني؟|अब भी प्यार है?|Masih sayang?') },
  'Zombie me|Я зомби|Я зомбі|Yo zombi|Eu zumbi|Ich als Zombie|Moi en zombie|Zombi ben|أنا زومبي|मैं ज़ोंबी|Aku zombi',
  'the person turning into a funny friendly cartoon zombie on a misty halloween street with jack-o-lanterns, glowing green fog, not gory');
add('v_elf', 'video', 'viral', '🧝', 'elf', { motion: 'gang', music: 'jingle', faces: 3, hot: true },
  'Elf dance|Танец эльфов|Танець ельфів|Baile de elfos|Dança dos elfos|Elfentanz|Danse des lutins|Elf dansı|رقصة الأقزام|एल्फ डांस|Tari peri',
  'the people as dancing christmas elves with pointy hats in a cozy toy workshop, funny synchronized dance');
add('v_trio', 'video', 'viral', '🐿️', 'parking', { motion: 'turns', music: 'pop', faces: 3 },
  'Trio dance (turns)|Танец втроём|Танець утрьох|Baile en trío|Dança em trio|Trio-Tanz|Danse en trio|Üçlü dans|رقص ثلاثي|तिकड़ी डांस|Tari bertiga',
  'three friends in a row at a gas station parking lot before sunrise, each takes a turn to the front and spins, music video');
add('v_viggle', 'video', 'viral', '🕺', 'disco', { motion: 'dance', music: 'disco', faces: 1, hot: true },
  'AI dance (any move)|ИИ-танец|ШІ-танець|Baile IA|Dança IA|KI-Tanz|Danse IA|YZ dansı|رقص بالذكاء|AI डांस|Tari AI',
  'the person doing a viral tiktok dance in a disco club with colorful spotlights, full body, smooth motion transfer');

// 😂 Funny & memes
add('m_shock', 'video', 'funny', '😱', 'shock', { motion: 'shock', music: 'drama', faces: 1 },
  'Meme: "Whaat?!"|Мем: «Чтоо?!»|Мем: «Щоо?!»|Meme: «¿¡Quéee?!»|Meme: "Quêee?!"|Meme: „Waaas?!"|Mème : « Quoiii ?! »|Mim: "Neee?!"|ميم: ماذا؟!|मीम: क्याआ?!|Meme: "Apaaa?!"',
  'dramatic zoom into the person shocked face, meme style, speed lines, comedic');
add('m_inflate', 'video', 'funny', '🎈', 'comic', { motion: 'inflate', music: 'toon', faces: 1, hot: true },
  'Inflate & fly away|Надуйся и улети|Надуйся і полети|Inflarse y volar|Inflar e voar|Aufblasen & wegfliegen|Gonfler et s\'envoler|Şişip uç|انتفخ وطِر|फूलकर उड़ जाओ|Mengembang & terbang',
  'the person inflates like a balloon and floats away, funny cartoon physics effect');
add('m_spin', 'video', 'funny', '🌀', 'toon', { motion: 'spin', music: 'toon', faces: 1 },
  'Cartoon spin|Мультяшная юла|Мультяшна дзиґа|Giro de dibujos|Giro de desenho|Cartoon-Dreher|Toupie cartoon|Çizgi film dönüşü|دوران كرتوني|कार्टून स्पिन|Putar kartun',
  'the person spinning like a cartoon character in a colorful toon town, funny');
add('m_talk', 'video', 'funny', '🗣️', 'podcast', { motion: 'talk', music: 'lofi', faces: 1, title: tr('Let me tell you…|Короче, слушай…|Коротше, слухай…|Te cuento…|Deixa eu te contar…|Pass auf…|Écoute ça…|Bak anlatayım…|دعني أخبرك…|सुनो ना…|Dengerin ya…') },
  'Talking photo|Говорящее фото|Фото, що говорить|Foto que habla|Foto falante|Sprechendes Foto|Photo qui parle|Konuşan fotoğraf|صورة ناطقة|बोलती फोटो|Foto bicara',
  'the person talking to camera on a podcast set, natural lip sync, expressive');
add('p_meme', 'photo', 'funny', '🤣', 'comic', { filter: 'pop', meme: true, title: tr('ME ON MONDAY|Я В ПОНЕДЕЛЬНИК|Я В ПОНЕДІЛОК|YO EL LUNES|EU NA SEGUNDA|ICH AM MONTAG|MOI LE LUNDI|PAZARTESİ BEN|أنا يوم الاثنين|सोमवार को मैं|AKU DI HARI SENIN') },
  'Meme with my face|Мем с моим лицом|Мем з моїм обличчям|Meme con mi cara|Meme com meu rosto|Meme mit meinem Gesicht|Mème avec ma tête|Yüzümle mim|ميم بوجهي|मेरे चेहरे वाला मीम|Meme wajahku',
  'pop art meme portrait of the person with exaggerated funny expression');
add('p_muscle', 'photo', 'funny', '💪', 'gym', { filter: 'gold', title: tr('Beast mode|Режим зверя|Режим звіра|Modo bestia|Modo fera|Biest-Modus|Mode bête|Canavar modu|وضع الوحش|बीस्ट मोड|Mode buas') },
  'Bodybuilder me|Я качок|Я качок|Yo culturista|Eu marombeiro|Ich als Bodybuilder|Moi bodybuilder|Kaslı ben|أنا كمال أجسام|मैं बॉडीबिल्डर|Aku binaragawan',
  'the person as a huge muscular bodybuilder in a dramatic gym, golden light, funny exaggerated muscles');

// ✨ AI avatars & styles
add('p_ghibli', 'photo', 'avatar', '🍃', 'ghibli', { filter: 'ghibli', hot: true },
  'Ghibli style|В стиле Ghibli|У стилі Ghibli|Estilo Ghibli|Estilo Ghibli|Ghibli-Stil|Style Ghibli|Ghibli tarzı|بأسلوب جيبلي|घिबली स्टाइल|Gaya Ghibli',
  'studio ghibli style hand painted anime portrait of the person in a summer meadow, soft watercolor');
add('p_anime', 'photo', 'avatar', '🌸', 'sakura', { filter: 'anime' },
  'Anime|Аниме|Аніме|Anime|Anime|Anime|Anime|Anime|أنمي|एनीमे|Anime',
  'anime style portrait of the person, pastel sky, cherry blossom petals, clean cel shading');
add('p_avatar', 'photo', 'avatar', '🔮', 'neon', { filter: 'neon' },
  'Magic AI avatar|Магический аватар|Магічний аватар|Avatar mágico|Avatar mágico|Magischer Avatar|Avatar magique|Sihirli avatar|أفاتار سحري|मैजिक अवतार|Avatar ajaib',
  'stylized magic avatar portrait of the person, cosmic neon glow, digital art, lensa style');
add('p_fantasy', 'photo', 'avatar', '🧙', 'castle', { filter: 'fantasy' },
  'Fantasy hero|Фэнтези-герой|Фентезі-герой|Héroe de fantasía|Herói de fantasia|Fantasy-Held|Héros fantasy|Fantastik kahraman|بطل خيالي|फैंटेसी हीरो|Pahlawan fantasi',
  'epic fantasy portrait of the person in ornate armor, magical purple glow, castle background');
add('p_astronaut', 'photo', 'avatar', '🚀', 'space', { filter: 'clean' },
  'Astronaut|Космонавт|Космонавт|Astronauta|Astronauta|Astronaut|Astronaute|Astronot|رائد فضاء|अंतरिक्ष यात्री|Astronaut',
  'portrait of the person as an astronaut, helmet visor open, stars and earth behind, cinematic');
add('p_hero', 'photo', 'avatar', '🦸', 'berlin', { filter: 'clean' },
  'Superhero|Супергерой|Супергерой|Superhéroe|Super-herói|Superheld|Super-héros|Süper kahraman|بطل خارق|सुपरहीरो|Superhero',
  'portrait of the person as a superhero with red cape above a city at sunset, cinematic');
add('p_business', 'photo', 'avatar', '💼', 'office', { filter: 'business' },
  'Business headshot|Бизнес-фото|Бізнес-фото|Foto de negocios|Foto profissional|Business-Porträt|Portrait pro|İş portresi|صورة أعمال|बिज़नेस फोटो|Foto bisnis',
  'professional corporate headshot of the person in a navy suit, office bokeh, studio lighting');
add('p_cyber', 'photo', 'avatar', '🌆', 'neon', { filter: 'neon' },
  'Cyberpunk|Киберпанк|Кіберпанк|Cyberpunk|Cyberpunk|Cyberpunk|Cyberpunk|Siberpunk|سايبربانك|साइबरपंक|Cyberpunk',
  'cyberpunk portrait of the person, neon pink and cyan lights, rainy night city');

// 🧸 Toys & figures
add('p_figure', 'photo', 'toys', '🧸', 'figurebox', { filter: 'toy', hot: true },
  'Action figure box|Я — фигурка в коробке|Я — фігурка в коробці|Figura de acción|Boneco na caixa|Actionfigur-Box|Figurine en boîte|Aksiyon figürü|مجسم في علبة|एक्शन फिगर बॉक्स|Figur aksi',
  'the person as a plastic action figure inside a blister package with accessories (phone, coffee, headphones, laptop, sneakers), starter pack style, product photo');
add('p_doll', 'photo', 'toys', '🎀', 'dollbox', { filter: 'toy' },
  'Fashion doll box|Кукла в коробке|Лялька в коробці|Muñeca en caja|Boneca na caixa|Puppe in der Box|Poupée en boîte|Kutuda bebek|دمية في علبة|डॉल बॉक्स|Boneka di kotak',
  'the person as a glamorous fashion doll inside a pink doll box with accessories, glossy plastic, product photo');
add('p_figurine', 'photo', 'toys', '🗿', 'figurine', { filter: 'toy', isNew: true },
  '3D figurine on desk|3D-фигурка на столе|3D-фігурка на столі|Figura 3D|Miniatura 3D|3D-Figur|Figurine 3D|3D figür|مجسم ثلاثي الأبعاد|3D मूर्ति|Figur 3D',
  'a realistic 1/7 scale collectible figurine of the person standing on a clear acrylic base on a desk, toy box and 3D modeling screen behind');

// 🔄 Transform
add('p_baby', 'photo', 'transform', '👶', 'nursery', { filter: 'baby' },
  'Baby me|Я в детстве|Я в дитинстві|Yo de bebé|Eu bebê|Ich als Baby|Moi bébé|Bebek ben|أنا طفل|बेबी मैं|Aku bayi',
  'the person as a cute baby toddler, same face features, in a pastel nursery, soft light');
add('p_aging', 'photo', 'transform', '👴', 'park', { filter: 'aged' },
  'Me at 80|Я в 80 лет|Я у 80 років|Yo a los 80|Eu aos 80|Ich mit 80|Moi à 80 ans|80 yaşında ben|أنا في الثمانين|80 की उम्र में|Aku usia 80',
  'the person aged to 80 years old, grey hair and wrinkles, warm smile, realistic portrait in a park');
add('v_oldphoto', 'video', 'transform', '📜', 'vintage', { motion: 'kenburns', filter: 'old', music: 'piano', faces: 1 },
  'Old photo comes alive|Оживи старое фото|Оживи старе фото|Foto antigua viva|Foto antiga viva|Altes Foto lebt|Vieille photo animée|Eski foto canlanıyor|صورة قديمة تحيا|पुरानी फोटो ज़िंदा|Foto lama hidup',
  'animate this old photo: the person blinks, smiles and slightly turns the head, vintage film grain, sepia');
add('p_oldphoto', 'photo', 'transform', '🎞️', 'vintage', { filter: 'old' },
  '1920s portrait|Портрет 1920-х|Портрет 1920-х|Retrato de 1920|Retrato anos 20|Porträt der 1920er|Portrait années 20|1920\'ler portresi|صورة العشرينيات|1920 का पोर्ट्रेट|Potret 1920-an',
  'the person as a 1920s sepia studio photograph in an antique frame, film grain');

// 📍 Places
add('p_paris', 'photo', 'place', '🗼', 'paris', { filter: 'clean' }, 'Me in Paris|Я в Париже|Я в Парижі|Yo en París|Eu em Paris|Ich in Paris|Moi à Paris|Paris\'te ben|أنا في باريس|पेरिस में मैं|Aku di Paris', 'photo of the person in front of the Eiffel tower at golden hour, realistic travel photo');
add('p_moon', 'photo', 'place', '🌕', 'moon', { filter: 'clean' }, 'Me on the Moon|Я на Луне|Я на Місяці|Yo en la Luna|Eu na Lua|Ich auf dem Mond|Moi sur la Lune|Ay\'da ben|أنا على القمر|चाँद पर मैं|Aku di Bulan', 'photo of the person on the moon surface, earth rising behind, realistic');
add('p_beach', 'photo', 'place', '🏝️', 'beach', { filter: 'warm' }, 'Me in the Maldives|Я на Мальдивах|Я на Мальдівах|Yo en Maldivas|Eu nas Maldivas|Ich auf den Malediven|Moi aux Maldives|Maldivler\'de ben|أنا في المالديف|मालदीव में मैं|Aku di Maladewa', 'photo of the person on a tropical Maldives beach, turquoise water, palm trees');
add('p_nyc', 'photo', 'place', '🗽', 'nyc', { filter: 'neon' }, 'Me in New York|Я в Нью-Йорке|Я в Нью-Йорку|Yo en Nueva York|Eu em Nova York|Ich in New York|Moi à New York|New York\'ta ben|أنا في نيويورك|न्यूयॉर्क में मैं|Aku di New York', 'photo of the person in Times Square at night, neon billboards');
add('p_tank', 'photo', 'place', '🪖', 'tankfield', { filter: 'clean' }, 'Me in a PRICOPBUM tank|Я в танке PRICOPBUM|Я в танку PRICOPBUM|Yo en un tanque PRICOPBUM|Eu no tanque PRICOPBUM|Ich im PRICOPBUM-Panzer|Moi dans un tank PRICOPBUM|PRICOPBUM tankında ben|أنا في دبابة PRICOPBUM|PRICOPBUM टैंक में मैं|Aku di tank PRICOPBUM', 'the person as commander in the hatch of a bright yellow cartoon tank, game art');

// 👯 Friends
add('v_hug', 'video', 'friends', '🤗', 'park', { motion: 'hug', music: 'love', faces: 2, hot: true },
  'Friendly hug|Обнимашки|Обіймашки|Abrazo|Abraço|Umarmung|Câlin|Sarılma|عناق ودي|प्यारी झप्पी|Pelukan',
  'two friends walk towards each other in a sunny park and share a warm friendly hug, wholesome');
add('v_gang', 'video', 'friends', '👯', 'disco', { motion: 'gang', music: 'disco', faces: 3 },
  'Squad dance|Банда друзей|Банда друзів|Baile de la pandilla|Dança da galera|Squad-Tanz|Danse en bande|Ekip dansı|رقصة الشلة|गैंग डांस|Tari geng',
  'three friends dancing together in a club, high energy music video');
add('v_wedding', 'video', 'friends', '💍', 'wedding', { motion: 'couple', music: 'love', faces: 2 },
  'Wedding|Свадьба|Весілля|Boda|Casamento|Hochzeit|Mariage|Düğün|زفاف|शादी|Pernikahan',
  'two people at a romantic wedding under a flower arch, confetti, cinematic');
add('v_toon', 'video', 'friends', '🎨', 'toon', { motion: 'gang', music: 'toon', faces: 2 },
  'Cartoon duo|Мультик вдвоём|Мультик удвох|Dúo animado|Dupla animada|Cartoon-Duo|Duo cartoon|Çizgi film ikilisi|ثنائي كرتوني|कार्टून जोड़ी|Duo kartun',
  'two people as pixar style cartoon characters having fun');

// 🎉 Greetings & cards
add('v_birthday', 'video', 'greeting', '🎂', 'birthday', { motion: 'bounce', music: 'birthday', faces: 1, title: tr('Happy Birthday!|С днём рождения!|З днем народження!|¡Feliz cumpleaños!|Feliz aniversário!|Alles Gute!|Joyeux anniversaire !|İyi ki doğdun!|عيد ميلاد سعيد!|जन्मदिन मुबारक!|Selamat ulang tahun!') },
  'Birthday video|Видео: День рождения|Відео: День народження|Video de cumpleaños|Vídeo de aniversário|Geburtstagsvideo|Vidéo anniversaire|Doğum günü videosu|فيديو عيد ميلاد|जन्मदिन वीडियो|Video ulang tahun',
  'birthday celebration video, the person as the star, balloons, confetti, cake with candles');
add('v_newyear', 'video', 'greeting', '🎄', 'newyear', { motion: 'bounce', music: 'jingle', faces: 1, title: tr('Happy New Year!|С Новым годом!|З Новим роком!|¡Feliz Año Nuevo!|Feliz Ano Novo!|Frohes neues Jahr!|Bonne année !|Mutlu yıllar!|سنة سعيدة!|नया साल मुबारक!|Selamat Tahun Baru!') },
  'New Year video|Видео: Новый год|Відео: Новий рік|Video de Año Nuevo|Vídeo de Ano Novo|Neujahrsvideo|Vidéo Nouvel An|Yılbaşı videosu|فيديو رأس السنة|नए साल का वीडियो|Video Tahun Baru',
  'new year celebration with fireworks and snow, the person smiling and waving');
add('c_birthday', 'photo', 'greeting', '🎈', 'birthday', { filter: 'warm', title: tr('Happy Birthday!|С днём рождения!|З днем народження!|¡Feliz cumpleaños!|Feliz aniversário!|Alles Gute!|Joyeux anniversaire !|İyi ki doğdun!|عيد ميلاد سعيد!|जन्मदिन मुबारक!|Selamat ulang tahun!') },
  'Birthday card|Открытка: День рождения|Листівка: День народження|Tarjeta de cumpleaños|Cartão de aniversário|Geburtstagskarte|Carte anniversaire|Doğum günü kartı|بطاقة عيد ميلاد|जन्मदिन कार्ड|Kartu ulang tahun',
  'festive birthday greeting card featuring the person with balloons, confetti and a cake');
add('c_newyear', 'photo', 'greeting', '❄️', 'newyear', { filter: 'warm', title: tr('Happy New Year!|С Новым годом!|З Новим роком!|¡Feliz Año Nuevo!|Feliz Ano Novo!|Frohes neues Jahr!|Bonne année !|Mutlu yıllar!|سنة سعيدة!|नया साल मुबारक!|Selamat Tahun Baru!') },
  'New Year card|Открытка: Новый год|Листівка: Новий рік|Tarjeta de Año Nuevo|Cartão de Ano Novo|Neujahrskarte|Carte Nouvel An|Yılbaşı kartı|بطاقة رأس السنة|नए साल का कार्ड|Kartu Tahun Baru',
  'new year greeting card featuring the person in a cozy sweater, christmas tree, snow, fireworks');
add('c_love', 'photo', 'greeting', '💖', 'love', { filter: 'warm', title: tr('Love you!|Люблю тебя!|Кохаю тебе!|¡Te quiero!|Te amo!|Hab dich lieb!|Je t\'aime !|Seni seviyorum!|أحبك!|आई लव यू!|Sayang kamu!') },
  'Love card|Открытка: Любовь|Листівка: Кохання|Tarjeta de amor|Cartão de amor|Liebeskarte|Carte d\'amour|Aşk kartı|بطاقة حب|लव कार्ड|Kartu cinta',
  'romantic valentine card featuring the person surrounded by hearts, pink glow');

// 🎬 Movies & games
add('v_tank', 'video', 'movie', '🪖', 'tankfield', { motion: 'tank', music: 'epic', faces: 1, title: tr('Tank hero in PRICOPBUM|Я танкист в PRICOPBUM|Я танкіст у PRICOPBUM|Tanquista en PRICOPBUM|Tanqueiro no PRICOPBUM|Panzerheld in PRICOPBUM|Tankiste dans PRICOPBUM|PRICOPBUM\'da tankçı|بطل الدبابة في PRICOPBUM|PRICOPBUM में टैंक हीरो|Pahlawan tank PRICOPBUM') },
  'Tank hero in PRICOPBUM|Я танкист в PRICOPBUM|Я танкіст у PRICOPBUM|Tanquista en PRICOPBUM|Tanqueiro no PRICOPBUM|Panzerheld in PRICOPBUM|Tankiste dans PRICOPBUM|PRICOPBUM\'da tankçı|بطل الدبابة في PRICOPBUM|PRICOPBUM में टैंक हीरो|Pahlawan tank PRICOPBUM',
  'the person as commander in the hatch of a bright yellow cartoon tank driving across a battlefield, game trailer');
add('v_slowmo', 'video', 'movie', '😎', 'boom', { motion: 'walk', music: 'epic', faces: 1 },
  'Cool walk from explosion|Крутой уход от взрыва|Крутий відхід від вибуху|Caminar tras la explosión|Saindo da explosão|Cooler Abgang|Sortie d\'explosion|Patlamadan havalı çıkış|مشية من الانفجار|धमाके से कूल वॉक|Jalan keren dari ledakan',
  'the person walking slowly towards camera in sunglasses while a huge explosion happens behind, slow motion');
add('v_football', 'video', 'movie', '⚽', 'stadium', { motion: 'goal', music: 'stadium', faces: 1, title: tr('GOAL!|ГОЛ!|ГОЛ!|¡GOL!|GOL!|TOR!|BUT !|GOL!|هدف!|गोल!|GOL!') },
  'Winning goal|Гол в финале|Гол у фіналі|Gol de la victoria|Gol da vitória|Siegtor|But de la victoire|Galibiyet golü|هدف الفوز|जीत का गोल|Gol kemenangan',
  'the person as a football player scoring the winning goal in a final, stadium crowd celebrating');
add('v_hero', 'video', 'movie', '🦸', 'berlin', { motion: 'fly', music: 'epic', faces: 1 },
  'Superhero flight|Полёт супергероя|Політ супергероя|Vuelo de superhéroe|Voo de super-herói|Superhelden-Flug|Vol de super-héros|Süper kahraman uçuşu|طيران بطل خارق|सुपरहीरो उड़ान|Terbang superhero',
  'the person as a superhero with red cape flying over a city at sunset');
add('v_action', 'video', 'movie', '💥', 'boom', { motion: 'action', music: 'epic', faces: 1 },
  'Action movie|Я в боевике|Я в бойовику|Película de acción|Filme de ação|Actionfilm|Film d\'action|Aksiyon filmi|فيلم أكشن|एक्शन फिल्म|Film laga',
  'the person as action movie hero running from an explosion, blockbuster');

const GROUPS = {
  viral: tr('🔥 Viral now|🔥 Тренды сейчас|🔥 Тренди зараз|🔥 Viral ahora|🔥 Viral agora|🔥 Gerade viral|🔥 Viral en ce moment|🔥 Şu an viral|🔥 رائج الآن|🔥 अभी वायरल|🔥 Lagi viral'),
  funny: tr('😂 Funny & memes|😂 Приколы и мемы|😂 Приколи та меми|😂 Humor y memes|😂 Humor e memes|😂 Lustig & Memes|😂 Drôle & mèmes|😂 Komik & mimler|😂 مضحك وميمز|😂 फनी और मीम्स|😂 Lucu & meme'),
  avatar: tr('✨ AI avatars & styles|✨ ИИ-аватары и стили|✨ ШІ-аватари та стилі|✨ Avatares IA|✨ Avatares IA|✨ KI-Avatare|✨ Avatars IA|✨ YZ avatarlar|✨ أفاتار بالذكاء|✨ AI अवतार|✨ Avatar AI'),
  toys: tr('🧸 Toys & figures|🧸 Фигурки и куклы|🧸 Фігурки та ляльки|🧸 Juguetes y figuras|🧸 Bonecos|🧸 Spielzeug & Figuren|🧸 Jouets & figurines|🧸 Oyuncak & figür|🧸 ألعاب ومجسمات|🧸 खिलौने और फिगर|🧸 Mainan & figur'),
  transform: tr('🔄 Transform|🔄 Превращения|🔄 Перетворення|🔄 Transformar|🔄 Transformar|🔄 Verwandlung|🔄 Transformations|🔄 Dönüşüm|🔄 تحويل|🔄 ट्रांसफ़ॉर्म|🔄 Transformasi'),
  place: tr('📍 Me anywhere|📍 Я в любом месте|📍 Я будь-де|📍 Yo en cualquier lugar|📍 Eu em qualquer lugar|📍 Ich überall|📍 Moi partout|📍 Her yerde ben|📍 أنا في أي مكان|📍 मैं कहीं भी|📍 Aku di mana saja'),
  friends: tr('👯 With friends|👯 С друзьями|👯 З друзями|👯 Con amigos|👯 Com amigos|👯 Mit Freunden|👯 Entre amis|👯 Arkadaşlarla|👯 مع الأصدقاء|👯 दोस्तों के साथ|👯 Bareng teman'),
  greeting: tr('🎉 Greetings & cards|🎉 Поздравления|🎉 Привітання|🎉 Felicitaciones|🎉 Felicitações|🎉 Grüße & Karten|🎉 Vœux & cartes|🎉 Tebrikler|🎉 تهاني وبطاقات|🎉 बधाई और कार्ड|🎉 Ucapan & kartu'),
  movie: tr('🎬 Movies & games|🎬 Кино и игры|🎬 Кіно та ігри|🎬 Cine y juegos|🎬 Filmes e jogos|🎬 Filme & Games|🎬 Films & jeux|🎬 Film & oyun|🎬 أفلام وألعاب|🎬 फिल्में और गेम|🎬 Film & game'),
};
const CHALLENGES = [
  { tpl: 'v_flamingo', name: tr('Best flamingo fail|Лучший фейл с фламинго|Найкращий фейл з фламінго|Mejor caída flamenco|Melhor queda flamingo|Bester Flamingo-Fail|Meilleur fail flamant|En iyi flamingo|أفضل سقوط فلامنغو|बेस्ट फ्लेमिंगो फेल|Flamingo terbaik') },
  { tpl: 'v_tank', name: tr('Best tank hero|Лучший танкист|Найкращий танкіст|Mejor tanquista|Melhor tanqueiro|Bester Panzerheld|Meilleur tankiste|En iyi tankçı|أفضل بطل دبابة|बेस्ट टैंक हीरो|Tankis terbaik') },
  { tpl: 'p_figure', name: tr('My starter pack|Мой стартер-пак|Мій стартер-пак|Mi starter pack|Meu starter pack|Mein Starterpack|Mon starter pack|Başlangıç paketim|حزمتي|मेरा स्टार्टर पैक|Starter pack-ku') },
  { tpl: 'm_shock', name: tr('Funniest "Whaat?!"|Самое смешное «Чтоо?!»|Найсмішніше «Щоо?!»|El «¿Qué?!» más gracioso|O "Quê?!" mais engraçado|Lustigstes „Was?!"|Le « Quoi ?! » le plus drôle|En komik "Ne?!"|أطرف ماذا؟!|सबसे फनी क्या?!|"Apa?!" terlucu') },
  { tpl: 'v_viggle', name: tr('Dance with PRICO AI|Танцуй с PRICO AI|Танцюй з PRICO AI|Baila con PRICO AI|Dance com PRICO AI|Tanz mit PRICO AI|Danse avec PRICO AI|PRICO AI ile dans et|ارقص مع PRICO AI|PRICO AI के साथ डांस|Menari dengan PRICO AI') },
  { tpl: 'p_ghibli', name: tr('Ghibli day|День Ghibli|День Ghibli|Día Ghibli|Dia Ghibli|Ghibli-Tag|Journée Ghibli|Ghibli günü|يوم جيبلي|घिबली डे|Hari Ghibli') },
  { tpl: 'v_hug', name: tr('Hug your bestie|Обними лучшего друга|Обійми найкращого друга|Abraza a tu mejor amigo|Abrace seu melhor amigo|Umarme deinen besten Freund|Câline ton meilleur ami|En iyi arkadaşına sarıl|عانق صديقك|बेस्टी को झप्पी|Peluk sahabatmu') },
];
fs.writeFileSync('server/templates.json', JSON.stringify({ version: 2, updated: '2026-11-05', groups: GROUPS, templates: T, challenges: CHALLENGES }, null, 1));
console.log(T.length, 'templates');
