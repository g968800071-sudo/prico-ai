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

// ===== v2 (Nov 2026 research: Pika-style physics FX, Viggle dances, couples, holidays, niches) =====
const V = (id, group, emoji, scene, o, names, prompt) => add(id, 'video', group, emoji, scene, { faces: 1, ...o }, names, prompt);
const P = (id, group, emoji, scene, o, names, prompt) => add(id, 'photo', group, emoji, scene, o, names, prompt);
// 💥 Physics FX
V('fx_squish', 'fx', '🫠', 'comic', { motion: 'squish', music: 'toon', hot: true, isNew: true }, 'Squish it|Сплющь меня|Сплющ мене|Aplástalo|Esmague|Quetsch mich|Écrase-moi|Ez beni|اضغطني|मुझे दबाओ|Penyet aku', 'giant hands squishing the person like a soft stress toy, squishy rubber physics, funny');
V('fx_melt', 'fx', '🫠', 'beach', { motion: 'melt', music: 'lofi', hot: true, isNew: true }, 'Melt it|Растаять|Розтанути|Derrítete|Derreter|Schmelzen|Fondre|Eri|ذوبان|पिघल जाओ|Meleleh', 'the person slowly melting like ice cream under the hot summer sun, gooey drips, funny');
V('fx_explode', 'fx', '💥', 'boom', { motion: 'explode', music: 'epic', hot: true, isNew: true }, 'Explode it|Взорвись|Вибухни|Explota|Exploda|Explodieren|Explose|Patla|انفجار|फट जाओ|Meledak', 'the person inflating then bursting into colorful confetti and sparks, cartoon explosion, not violent');
V('fx_cake', 'fx', '🎂', 'cake', { motion: 'jelly', music: 'toon', filter: 'toy', particles: 'confetti', hot: true, isNew: true, title: tr("It's cake?!|Это торт?!|Це торт?!|¿¡Es pastel?!|É bolo?!|Das ist Kuchen?!|C'est un gâteau ?!|Bu pasta mı?!|إنها كعكة؟!|ये केक है?!|Ini kue?!") }, 'Cake-ify me|Я — торт|Я — торт|Hazme pastel|Vire bolo|Mach mich zu Kuchen|Moi en gâteau|Beni pasta yap|حولني لكعكة|मुझे केक बनाओ|Jadikan aku kue', 'a knife slices the person revealing they are a hyper-realistic layered cake inside, surprise reveal, cakeify trend');
V('fx_crash', 'fx', '📸', 'kpop', { motion: 'crashzoom', music: 'trap', isNew: true }, 'Crash zoom|Краш-зум|Краш-зум|Zoom choque|Zoom impacto|Crash-Zoom|Zoom choc|Çarpma zoom|تقريب صادم|क्रैश ज़ूम|Zoom kilat', 'dramatic crash zoom into the person on stage, chromatic aberration, hype edit');
V('fx_tiny', 'fx', '🤏', 'cake', { motion: 'shrink', music: 'toon', isNew: true }, 'Tiny me|Крошечный я|Крихітний я|Yo diminuto|Eu minúsculo|Mini-Ich|Mini moi|Minik ben|أنا الصغير|छोटा सा मैं|Aku mungil', 'the person shrinking to the size of a sprinkle on a giant cake, funny scale shot');
V('fx_jelly', 'fx', '🍮', 'toon', { motion: 'jelly', music: 'toon' }, 'Jelly wobble|Желейный я|Желейний я|Gelatina|Gelatina|Wackelpudding|Gelée|Jöle|هلام|जेली|Jeli', 'the person wobbling like jelly pudding, bouncy cartoon physics');
V('fx_glitch', 'fx', '👾', 'tokyo', { motion: 'glitch', music: 'trap', isNew: true }, 'Glitch me|Глитч|Глітч|Glitch|Glitch|Glitch|Glitch|Glitch|غليتش|ग्लिच|Glitch', 'the person glitching in a neon tokyo street, digital RGB split, datamosh');
V('fx_vhs', 'fx', '📼', 'vintage', { motion: 'vhs', music: 'lofi', filter: 'retro' }, 'VHS 1999|VHS 1999|VHS 1999|VHS 1999|VHS 1999|VHS 1999|VHS 1999|VHS 1999|VHS 1999|VHS 1999|VHS 1999', 'home video from 1999, VHS tape look, scanlines, warm faded colors');
V('fx_polaroid', 'fx', '🖼️', 'vintage', { motion: 'develop', music: 'piano', filter: 'retro', isNew: true }, 'Polaroid develop|Проявка полароида|Проявка полароїда|Polaroid revelado|Polaroid revelando|Polaroid entwickeln|Polaroid qui se révèle|Polaroid banyo|بولارويد يتحمض|पोलरॉइड डेवलप|Polaroid muncul', 'an instant polaroid photo of the person slowly developing from white, nostalgic aesthetic');
// 💃 Dances
V('d_hallway', 'dance', '🏫', 'hallway', { motion: 'dance', music: 'pop', hot: true, isNew: true }, 'Hallway dance|Танец в коридоре|Танець у коридорі|Baile en el pasillo|Dança no corredor|Flur-Tanz|Danse du couloir|Koridor dansı|رقصة الممر|हॉलवे डांस|Tari lorong', 'the person doing the viral school hallway dance, full body, smooth motion transfer');
V('d_kpop', 'dance', '🎤', 'kpop', { motion: 'gang', music: 'pop', faces: 3, hot: true }, 'K-pop group dance|К-поп группа|К-поп гурт|Baile K-pop|Dança K-pop|K-Pop-Gruppentanz|Danse K-pop|K-pop grup dansı|رقص كيبوب|के-पॉप डांस|Tari K-pop', 'the people as a k-pop group performing synchronized choreography on a concert stage with lasers');
V('d_samba', 'dance', '🪅', 'carnival', { motion: 'dance', music: 'funk', isNew: true }, 'Samba carnival|Карнавал самбы|Карнавал самби|Samba de carnaval|Samba no carnaval|Samba-Karneval|Samba du carnaval|Samba karnavalı|كرنفال السامبا|सांबा कार्निवल|Karnaval samba', 'the person dancing samba in a sparkling feather costume at rio carnival');
V('d_office', 'dance', '💼', 'office', { motion: 'bounce', music: 'funk' }, 'Office happy dance|Танец в офисе|Танець в офісі|Baile de oficina|Dança no escritório|Büro-Freudentanz|Danse au bureau|Ofis dansı|رقصة المكتب|ऑफिस डांस|Joget kantor', 'the person doing a goofy happy dance at the office when it is friday');
V('d_spin', 'dance', '🌀', 'disco', { motion: 'spin', music: 'disco' }, 'Spin & freeze|Крутись и замри|Крутись і завмри|Gira y congela|Gire e congele|Dreh & Freeze|Tourne & fige|Dön ve dur|دوران وتجمد|स्पिन और फ्रीज़|Putar & diam', 'the person spinning on the dance floor then freezing in a cool pose');
V('d_runway', 'dance', '👠', 'runway', { motion: 'strut', music: 'trap', hot: true }, 'Runway walk|Подиум|Подіум|Pasarela|Passarela|Laufsteg|Défilé|Podyum yürüyüşü|منصة عرض|रनवे वॉक|Jalan runway', 'the person walking a high fashion runway in paris, camera flashes, model walk');
V('d_tokyo', 'dance', '🌃', 'tokyo', { motion: 'walk', music: 'lofi' }, 'Tokyo night walk|Ночной Токио|Нічний Токіо|Noche en Tokio|Noite em Tóquio|Tokio bei Nacht|Nuit à Tokyo|Tokyo gecesi|ليل طوكيو|टोक्यो की रात|Malam Tokyo', 'the person walking through rainy neon tokyo at night, cinematic slow motion');
V('d_emote', 'dance', '🎮', 'gamer', { motion: 'dance', music: 'trap', isNew: true }, 'Victory emote|Победный эмоут|Переможний емоут|Emote de victoria|Emote da vitória|Sieges-Emote|Emote de victoire|Zafer dansı|رقصة الفوز|विक्ट्री इमोट|Emote menang', 'the person doing a video game victory emote dance in a gaming room');
// 💞 Couples
V('c_kiss', 'couple', '💋', 'love', { motion: 'hug', music: 'love', faces: 2, hot: true, isNew: true }, 'Kiss effect|Поцелуй|Поцілунок|Efecto beso|Efeito beijo|Kuss-Effekt|Effet bisou|Öpücük efekti|تأثير القبلة|किस इफेक्ट|Efek cium', 'two people from two photos lean in for a sweet romantic kiss, hearts, soft light, tasteful');
V('c_globe', 'couple', '🔮', 'snowglobe', { motion: 'hug', music: 'jingle', faces: 2, isNew: true }, 'Snow globe hug|Объятия в снежном шаре|Обійми у сніжній кулі|Abrazo en bola de nieve|Abraço no globo de neve|Umarmung in der Schneekugel|Câlin boule à neige|Kar küresi sarılma|عناق كرة الثلج|स्नो ग्लोब हग|Pelukan bola salju', 'two tiny people hugging inside a magical snow globe, snowflakes swirling');
V('c_dubai', 'couple', '🌇', 'dubai', { motion: 'couple', music: 'love', faces: 2 }, 'Dubai rooftop date|Свидание в Дубае|Побачення в Дубаї|Cita en Dubái|Encontro em Dubai|Date in Dubai|Rendez-vous à Dubaï|Dubai randevusu|موعد في دبي|दुबई डेट|Kencan di Dubai', 'a couple on a luxury rooftop in dubai at sunset, romantic');
V('c_besties', 'couple', '👯', 'hallway', { motion: 'turns', music: 'pop', faces: 2 }, 'Besties turn|Лучшие друзья|Найкращі друзі|Mejores amigas|Melhores amigos|Beste Freunde|Meilleurs amis|Kankalar|أعز الأصدقاء|बेस्टीज़|Sahabat', 'two best friends take turns spinning in a school hallway, fun music video');
// 🎃 Seasons & holidays
P('s_halloween', 'season', '🎃', 'halloween', { filter: 'fantasy', hot: true, isNew: true, title: tr('Happy Halloween!|С Хэллоуином!|З Гелловіном!|¡Feliz Halloween!|Feliz Halloween!|Happy Halloween!|Joyeux Halloween !|Mutlu Cadılar Bayramı!|هالوين سعيد!|हैप्पी हैलोवीन!|Selamat Halloween!') }, 'Halloween portrait|Хэллоуин-портрет|Гелловін-портрет|Retrato Halloween|Retrato de Halloween|Halloween-Porträt|Portrait Halloween|Cadılar portresi|صورة هالوين|हैलोवीन पोर्ट्रेट|Potret Halloween', 'the person in a cute spooky halloween costume on a pumpkin-lit street, purple fog');
V('s_trick', 'season', '👻', 'halloween', { motion: 'bounce', music: 'drama', filter: 'zombie', title: tr('Trick or treat!|Сладость или гадость!|Цукерки або життя!|¡Truco o trato!|Gostosuras ou travessuras!|Süßes oder Saures!|Un bonbon ou un sort !|Şeker mi şaka mı!|حلوى أم خدعة!|ट्रिक या ट्रीट!|Trick or treat!') }, 'Trick or treat|Сладость или гадость|Цукерки або життя|Truco o trato|Doces ou travessuras|Süßes oder Saures|Bonbon ou sort|Şeker mi şaka mı|حلوى أم خدعة|ट्रिक या ट्रीट|Trick or treat', 'the person as a friendly monster bouncing on a halloween porch with jack-o-lanterns');
P('s_xmas', 'season', '🎄', 'christmas', { filter: 'warm', hot: true, isNew: true, title: tr('Merry Christmas!|С Рождеством!|З Різдвом!|¡Feliz Navidad!|Feliz Natal!|Frohe Weihnachten!|Joyeux Noël !|Mutlu Noeller!|عيد ميلاد مجيد!|मेरी क्रिसमस!|Selamat Natal!') }, 'Christmas card|Рождественская открытка|Різдвяна листівка|Tarjeta navideña|Cartão de Natal|Weihnachtskarte|Carte de Noël|Noel kartı|بطاقة عيد الميلاد|क्रिसमस कार्ड|Kartu Natal', 'the person in a cozy christmas sweater by the glowing tree and fireplace');
V('s_xmas_v', 'season', '🎅', 'christmas', { motion: 'bounce', music: 'jingle', title: tr('Merry Christmas!|С Рождеством!|З Різдвом!|¡Feliz Navidad!|Feliz Natal!|Frohe Weihnachten!|Joyeux Noël !|Mutlu Noeller!|عيد ميلاد مجيد!|मेरी क्रिसमस!|Selamat Natal!') }, 'Christmas groove|Рождественский танец|Різдвяний танець|Baile navideño|Dança de Natal|Weihnachts-Groove|Groove de Noël|Noel dansı|رقصة الميلاد|क्रिसमस ग्रूव|Goyang Natal', 'the person dancing happily by the christmas tree, snow falling outside');
P('s_globe', 'season', '❄️', 'snowglobe', { filter: 'toy', isNew: true }, 'Me in a snow globe|Я в снежном шаре|Я у сніжній кулі|Yo en bola de nieve|Eu no globo de neve|Ich in der Schneekugel|Moi dans une boule à neige|Kar küresinde ben|أنا في كرة الثلج|स्नो ग्लोब में मैं|Aku di bola salju', 'the person as a tiny figure inside a magical snow globe with a winter village');
P('s_diwali', 'season', '🪔', 'diwali', { filter: 'gold', hot: true, title: tr('Happy Diwali!|Счастливого Дивали!|Щасливого Дивалі!|¡Feliz Diwali!|Feliz Diwali!|Frohes Diwali!|Joyeux Diwali !|Mutlu Diwali!|ديوالي سعيد!|हैप्पी दिवाली!|Selamat Diwali!') }, 'Diwali lights|Огни Дивали|Вогні Дивалі|Luces de Diwali|Luzes de Diwali|Diwali-Lichter|Lumières de Diwali|Diwali ışıkları|أضواء ديوالي|दिवाली की रोशनी|Cahaya Diwali', 'the person in festive traditional clothes among glowing diyas and rangoli, fireworks');
V('s_diwali_v', 'season', '🎆', 'diwali', { motion: 'dance', music: 'stadium', title: tr('Happy Diwali!|Счастливого Дивали!|Щасливого Дивалі!|¡Feliz Diwali!|Feliz Diwali!|Frohes Diwali!|Joyeux Diwali !|Mutlu Diwali!|ديوالي سعيد!|हैप्पी दिवाली!|Selamat Diwali!') }, 'Diwali dance|Танец Дивали|Танець Дивалі|Baile Diwali|Dança de Diwali|Diwali-Tanz|Danse de Diwali|Diwali dansı|رقصة ديوالي|दिवाली डांस|Tari Diwali', 'the person dancing joyfully at a diwali celebration with fireworks');
P('s_ramadan', 'season', '🌙', 'ramadan', { filter: 'warm', title: tr('Ramadan Kareem|Рамадан Карим|Рамадан Карім|Ramadán Kareem|Ramadan Kareem|Ramadan Kareem|Ramadan Kareem|Hayırlı Ramazanlar|رمضان كريم|रमज़ान करीम|Ramadan Kareem') }, 'Ramadan lanterns|Фонари Рамадана|Ліхтарі Рамадану|Faroles de Ramadán|Lanternas do Ramadã|Ramadan-Laternen|Lanternes du Ramadan|Ramazan fenerleri|فوانيس رمضان|रमज़ान लालटेन|Lentera Ramadan', 'the person in an elegant courtyard with glowing ramadan lanterns and a crescent moon');
V('s_eid', 'season', '✨', 'ramadan', { motion: 'bounce', music: 'piano', title: tr('Eid Mubarak!|Ид Мубарак!|Ід Мубарак!|¡Eid Mubarak!|Eid Mubarak!|Eid Mubarak!|Aïd Moubarak !|Bayramınız mübarek!|عيد مبارك!|ईद मुबारक!|Selamat Idul Fitri!') }, 'Eid Mubarak|Ид Мубарак|Ід Мубарак|Eid Mubarak|Eid Mubarak|Eid Mubarak|Aïd Moubarak|Bayram tebriği|عيد مبارك|ईद मुबारक|Selamat Lebaran', 'the person greeting happily in a lantern-lit courtyard for eid');
P('s_lunar', 'season', '🧧', 'lunar', { filter: 'gold', isNew: true, title: tr('Happy Lunar New Year!|С Лунным Новым годом!|З Місячним Новим роком!|¡Feliz Año Nuevo Lunar!|Feliz Ano Novo Lunar!|Frohes Mondneujahr!|Bon Nouvel An lunaire !|Mutlu Ay Yeni Yılı!|سنة قمرية سعيدة!|हैप्पी लूनर न्यू ईयर!|Selamat Tahun Baru Imlek!') }, 'Lunar New Year|Лунный Новый год|Місячний Новий рік|Año Nuevo Lunar|Ano Novo Lunar|Mondneujahr|Nouvel An lunaire|Ay Yeni Yılı|السنة القمرية|लूनर न्यू ईयर|Imlek', 'the person in a festive red outfit under hundreds of red lanterns, golden dragon');
V('s_lunar_v', 'season', '🐉', 'lunar', { motion: 'dance', music: 'epic' }, 'Dragon dance|Танец дракона|Танець дракона|Danza del dragón|Dança do dragão|Drachentanz|Danse du dragon|Ejderha dansı|رقصة التنين|ड्रैगन डांस|Tarian naga', 'the person dancing in a lantern street during lunar new year celebrations');
P('s_valentine', 'season', '💘', 'love', { filter: 'pop', title: tr('Be my Valentine|Будь моей валентинкой|Будь моєю валентинкою|Sé mi San Valentín|Seja meu Valentim|Sei mein Valentin|Sois mon Valentin|Sevgilim ol|كن فالنتايني|मेरे वैलेंटाइन बनो|Jadilah Valentine-ku') }, 'Valentine card|Валентинка|Валентинка|Tarjeta San Valentín|Cartão Dia dos Namorados|Valentinskarte|Carte Saint-Valentin|Sevgililer kartı|بطاقة فالنتاين|वैलेंटाइन कार्ड|Kartu Valentine', 'the person on a dreamy pink valentine background with hearts');
P('s_carnival', 'season', '🎭', 'carnival', { filter: 'pop' }, 'Carnival star|Звезда карнавала|Зірка карнавалу|Estrella del carnaval|Estrela do carnaval|Karnevalsstar|Star du carnaval|Karnaval yıldızı|نجم الكرنفال|कार्निवल स्टार|Bintang karnaval', 'the person in a sparkling feathered carnival costume at night, confetti');
// 📍 Places
P('pl_tokyo', 'place', '🗼', 'tokyo', { filter: 'neon', hot: true }, 'Me in Tokyo|Я в Токио|Я в Токіо|Yo en Tokio|Eu em Tóquio|Ich in Tokio|Moi à Tokyo|Tokyo\'da ben|أنا في طوكيو|टोक्यो में मैं|Aku di Tokyo', 'the person on a rainy neon street in tokyo at night');
P('pl_dubai', 'place', '🏙️', 'dubai', { filter: 'gold', hot: true }, 'Dubai lifestyle|Жизнь в Дубае|Життя в Дубаї|Vida en Dubái|Vida em Dubai|Dubai-Lifestyle|Lifestyle à Dubaï|Dubai yaşamı|حياة دبي|दुबई लाइफस्टाइल|Gaya hidup Dubai', 'the person on a luxury dubai rooftop with burj khalifa at golden hour');
P('pl_ocean', 'place', '🧜', 'ocean', { filter: 'fantasy', isNew: true }, 'Underwater mermaid|Русалка под водой|Русалка під водою|Sirena submarina|Sereia|Unterwasser-Meerjungfrau|Sirène sous l\'eau|Su altı denizkızı|حورية تحت الماء|पानी के नीचे जलपरी|Putri duyung', 'the person as a mermaid or merman in a coral reef with sun rays');
V('pl_swim', 'place', '🐠', 'ocean', { motion: 'fly', music: 'summer' }, 'Swim with fish|Плыви с рыбками|Пливи з рибками|Nada con peces|Nade com peixes|Mit Fischen schwimmen|Nage avec les poissons|Balıklarla yüz|اسبح مع الأسماك|मछलियों संग तैरो|Berenang dengan ikan', 'the person swimming through a coral reef among tropical fish');
P('pl_redcarpet', 'place', '🌟', 'redcarpet', { filter: 'clean', hot: true }, 'Red carpet star|Звезда красной дорожки|Зірка червоної доріжки|Estrella alfombra roja|Estrela do tapete vermelho|Roter-Teppich-Star|Star du tapis rouge|Kırmızı halı yıldızı|نجم السجادة الحمراء|रेड कार्पेट स्टार|Bintang karpet merah', 'the person posing on a red carpet premiere with paparazzi flashes');
P('pl_runway', 'place', '👗', 'runway', { filter: 'business' }, 'Fashion week model|Модель недели моды|Модель тижня моди|Modelo de pasarela|Modelo da semana de moda|Fashion-Week-Model|Mannequin fashion week|Moda haftası modeli|عارض أسبوع الموضة|फैशन वीक मॉडल|Model fashion week', 'the person as a model on a paris fashion week runway');
// ✨ Avatars & styles
P('a_kpop', 'avatar', '💜', 'kpop', { filter: 'pop', hot: true, isNew: true }, 'K-pop idol|К-поп айдол|К-поп айдол|Ídolo K-pop|Ídolo K-pop|K-Pop-Idol|Idole K-pop|K-pop idolü|نجم كيبوب|के-पॉप आइडल|Idola K-pop', 'the person as a k-pop idol on stage, glossy concert photo');
P('a_cyber', 'avatar', '🤖', 'tokyo', { filter: 'cyber', isNew: true }, 'Cyberpunk me|Киберпанк|Кіберпанк|Ciberpunk|Cyberpunk|Cyberpunk-Ich|Moi cyberpunk|Siberpunk ben|سايبربانك|साइबरपंक मैं|Cyberpunk aku', 'the person as a cyberpunk character with neon implants in a futuristic city');
P('a_noir', 'avatar', '🎞️', 'vintage', { filter: 'noir' }, 'Film noir|Нуар|Нуар|Cine negro|Filme noir|Film noir|Film noir|Kara film|فيلم نوار|फिल्म न्वार|Film noir', 'the person as a 1940s film noir character, black and white, dramatic shadows');
P('a_pastel', 'avatar', '🩷', 'cake', { filter: 'pastel' }, 'Pastel dream|Пастельная мечта|Пастельна мрія|Sueño pastel|Sonho pastel|Pastelltraum|Rêve pastel|Pastel rüya|حلم الباستيل|पेस्टल ड्रीम|Mimpi pastel', 'the person in a soft dreamy pastel aesthetic portrait');
P('a_sketch', 'avatar', '✏️', 'comic', { filter: 'sketch', isNew: true }, 'Pencil sketch|Карандашный рисунок|Олівцевий малюнок|Dibujo a lápiz|Desenho a lápis|Bleistiftskizze|Croquis au crayon|Karakalem|رسم بالقلم|पेंसिल स्केच|Sketsa pensil', 'the person as a detailed pencil sketch drawing');
P('a_retro', 'avatar', '🪩', 'disco', { filter: 'retro' }, '70s retro|Ретро 70-х|Ретро 70-х|Retro 70s|Retrô anos 70|70er Retro|Rétro 70s|70\'ler retro|ريترو السبعينات|70s रेट्रो|Retro 70-an', 'the person as a 1970s disco star, film grain, warm tones');
P('a_anime2', 'avatar', '🌸', 'tokyo', { filter: 'anime' }, 'Anime hero|Аниме-герой|Аніме-герой|Héroe anime|Herói de anime|Anime-Held|Héros d\'anime|Anime kahramanı|بطل أنمي|एनीमे हीरो|Pahlawan anime', 'the person as an anime protagonist in neon tokyo, cel-shaded');
// 🎬 Movies & games
P('g_streamer', 'movie', '🕹️', 'gamer', { filter: 'neon' }, 'Pro streamer|Про-стример|Про-стример|Streamer pro|Streamer pro|Pro-Streamer|Streamer pro|Profesyonel yayıncı|ستريمر محترف|प्रो स्ट्रीमर|Streamer pro', 'the person as a pro gamer in an RGB streaming room');
V('g_boss', 'movie', '⚔️', 'gamer', { motion: 'action', music: 'epic', title: tr('BOSS FIGHT|БИТВА С БОССОМ|БИТВА З БОСОМ|JEFE FINAL|CHEFÃO|BOSSKAMPF|COMBAT DE BOSS|BOSS SAVAŞI|قتال الزعيم|बॉस फाइट|LAWAN BOS') }, 'Boss fight|Битва с боссом|Битва з босом|Pelea de jefe|Luta contra chefão|Bosskampf|Combat de boss|Boss savaşı|قتال الزعيم|बॉस फाइट|Lawan bos', 'the person as a video game hero in an epic boss fight, game HUD');
// 😂 Funny
V('f_brainrot', 'funny', '🧠', 'gamer', { motion: 'talk', music: 'trap', hot: true, isNew: true, title: tr('POV: brainrot|POV: брейнрот|POV: брейнрот|POV: brainrot|POV: brainrot|POV: Brainrot|POV : brainrot|POV: brainrot|POV: برينروت|POV: ब्रेनरॉट|POV: brainrot') }, 'Brainrot narrator|Брейнрот-рассказчик|Брейнрот-оповідач|Narrador brainrot|Narrador brainrot|Brainrot-Erzähler|Narrateur brainrot|Brainrot anlatıcı|راوي برينروت|ब्रेनरॉट नैरेटर|Narator brainrot', 'the person talking to camera with chaotic brainrot energy over gameplay footage');
V('f_npc', 'funny', '🤖', 'tokyo', { motion: 'jelly', music: 'toon', title: tr('NPC MODE|РЕЖИМ NPC|РЕЖИМ NPC|MODO NPC|MODO NPC|NPC-MODUS|MODE PNJ|NPC MODU|وضع NPC|NPC मोड|MODE NPC') }, 'NPC mode|Режим NPC|Режим NPC|Modo NPC|Modo NPC|NPC-Modus|Mode PNJ|NPC modu|وضع NPC|NPC मोड|Mode NPC', 'the person acting like a video game NPC with repetitive motions, funny');
P('f_cake', 'funny', '🍰', 'cake', { filter: 'toy', meme: true, title: tr("WAIT, IT'S CAKE?!|СТОП, ЭТО ТОРТ?!|СТОП, ЦЕ ТОРТ?!|¡¿ESPERA, ES PASTEL?!|PERA, É BOLO?!|MOMENT, KUCHEN?!|ATTENDS, UN GÂTEAU ?!|DUR, PASTA MI?!|لحظة، كعكة؟!|रुको, ये केक है?!|TUNGGU, INI KUE?!") }, 'Is it cake?|Это торт?|Це торт?|¿Es pastel?|É bolo?|Ist das Kuchen?|C\'est un gâteau ?|Pasta mı?|هل هي كعكة؟|क्या ये केक है?|Itu kue?', 'the person rendered as a hyper-realistic cake on a bakery counter, is-it-cake meme');
// 💼 For your niche
P('n_food', 'niche', '🍳', 'cake', { filter: 'warm', title: tr('NEW RECIPE|НОВЫЙ РЕЦЕПТ|НОВИЙ РЕЦЕПТ|NUEVA RECETA|NOVA RECEITA|NEUES REZEPT|NOUVELLE RECETTE|YENİ TARİF|وصفة جديدة|नई रेसिपी|RESEP BARU') }, 'Food blogger cover|Обложка фуд-блогера|Обкладинка фуд-блогера|Portada foodie|Capa de food blogger|Food-Blog-Cover|Couverture food|Yemek blog kapağı|غلاف مدون طعام|फूड ब्लॉगर कवर|Sampul food blogger', 'the person as a food blogger in a pastel kitchen with cakes, cover image');
P('n_fitness', 'niche', '💪', 'gym', { filter: 'pop', title: tr('DAY 1 → DAY 100|ДЕНЬ 1 → ДЕНЬ 100|ДЕНЬ 1 → ДЕНЬ 100|DÍA 1 → DÍA 100|DIA 1 → DIA 100|TAG 1 → TAG 100|JOUR 1 → JOUR 100|1. GÜN → 100. GÜN|اليوم 1 ← اليوم 100|दिन 1 → दिन 100|HARI 1 → HARI 100') }, 'Fitness transformation|Фитнес-трансформация|Фітнес-трансформація|Transformación fitness|Transformação fitness|Fitness-Verwandlung|Transformation fitness|Fitness dönüşümü|تحول رياضي|फिटनेस ट्रांसफॉर्मेशन|Transformasi fitness', 'the person as a fit athlete in a gym, motivational cover');
P('n_ceo', 'niche', '📈', 'office', { filter: 'business', title: tr('CEO MODE|РЕЖИМ CEO|РЕЖИМ CEO|MODO CEO|MODO CEO|CEO-MODUS|MODE PDG|CEO MODU|وضع المدير|CEO मोड|MODE CEO') }, 'CEO mode|Режим CEO|Режим CEO|Modo CEO|Modo CEO|CEO-Modus|Mode PDG|CEO modu|وضع المدير|CEO मोड|Mode CEO', 'the person as a confident CEO in a modern office, business headshot');
P('n_beauty', 'niche', '💄', 'runway', { filter: 'pastel', title: tr('GLOW UP|ГЛОУ-АП|ГЛОУ-АП|GLOW UP|GLOW UP|GLOW-UP|GLOW UP|GLOW UP|تألق|ग्लो अप|GLOW UP') }, 'Beauty blogger|Бьюти-блогер|Б\'юті-блогер|Bloguera de belleza|Blogueira de beleza|Beauty-Bloggerin|Blogueuse beauté|Güzellik blogger|مدونة جمال|ब्यूटी ब्लॉगर|Beauty blogger', 'the person as a beauty influencer with soft glam lighting');
V('n_live', 'niche', '🔴', 'gamer', { motion: 'talk', music: 'trap', title: tr('LIVE NOW|УЖЕ В ЭФИРЕ|ВЖЕ В ЕФІРІ|EN VIVO|AO VIVO|JETZT LIVE|EN DIRECT|ŞİMDİ CANLI|مباشر الآن|अभी लाइव|LIVE SEKARANG') }, 'Going live promo|Анонс эфира|Анонс ефіру|Promo directo|Promo ao vivo|Live-Ankündigung|Promo live|Canlı yayın tanıtımı|إعلان البث|लाइव प्रोमो|Promo live', 'the person announcing a live stream in a gaming room, energetic');
P('n_travel', 'niche', '✈️', 'dubai', { filter: 'warm', title: tr('TRAVEL VLOG|ТРЕВЕЛ-ВЛОГ|ТРЕВЕЛ-ВЛОГ|VLOG DE VIAJE|VLOG DE VIAGEM|REISE-VLOG|VLOG VOYAGE|SEYAHAT VLOG|مدونة سفر|ट्रैवल व्लॉग|VLOG TRAVEL') }, 'Travel vlog cover|Обложка тревел-влога|Обкладинка тревел-влогу|Portada vlog viaje|Capa vlog de viagem|Reise-Vlog-Cover|Couverture vlog voyage|Seyahat vlog kapağı|غلاف مدونة سفر|ट्रैवल व्लॉग कवर|Sampul vlog travel', 'the person as a travel vlogger at a luxury destination, thumbnail');
V('n_music', 'niche', '🎧', 'kpop', { motion: 'dance', music: 'trap', title: tr('NEW SINGLE OUT NOW|НОВЫЙ СИНГЛ|НОВИЙ СИНГЛ|NUEVO SINGLE|NOVO SINGLE|NEUE SINGLE|NOUVEAU SINGLE|YENİ SINGLE|أغنية جديدة|नया सिंगल|SINGLE BARU') }, 'Music release promo|Промо релиза|Промо релізу|Promo lanzamiento|Promo de lançamento|Release-Promo|Promo de sortie|Yayın tanıtımı|ترويج إصدار|म्यूज़िक प्रोमो|Promo rilis', 'the person as a music artist on stage promoting a new single');

const GROUPS = {
  viral: tr('🔥 Viral now|🔥 Тренды сейчас|🔥 Тренди зараз|🔥 Viral ahora|🔥 Viral agora|🔥 Gerade viral|🔥 Viral en ce moment|🔥 Şu an viral|🔥 رائج الآن|🔥 अभी वायरल|🔥 Lagi viral'),
  funny: tr('😂 Funny & memes|😂 Приколы и мемы|😂 Приколи та меми|😂 Humor y memes|😂 Humor e memes|😂 Lustig & Memes|😂 Drôle & mèmes|😂 Komik & mimler|😂 مضحك وميمز|😂 फनी और मीम्स|😂 Lucu & meme'),
  avatar: tr('✨ AI avatars & styles|✨ ИИ-аватары и стили|✨ ШІ-аватари та стилі|✨ Avatares IA|✨ Avatares IA|✨ KI-Avatare|✨ Avatars IA|✨ YZ avatarlar|✨ أفاتار بالذكاء|✨ AI अवतार|✨ Avatar AI'),
  toys: tr('🧸 Toys & figures|🧸 Фигурки и куклы|🧸 Фігурки та ляльки|🧸 Juguetes y figuras|🧸 Bonecos|🧸 Spielzeug & Figuren|🧸 Jouets & figurines|🧸 Oyuncak & figür|🧸 ألعاب ومجسمات|🧸 खिलौने और फिगर|🧸 Mainan & figur'),
  transform: tr('🔄 Transform|🔄 Превращения|🔄 Перетворення|🔄 Transformar|🔄 Transformar|🔄 Verwandlung|🔄 Transformations|🔄 Dönüşüm|🔄 تحويل|🔄 ट्रांसफ़ॉर्म|🔄 Transformasi'),
  place: tr('📍 Me anywhere|📍 Я в любом месте|📍 Я будь-де|📍 Yo en cualquier lugar|📍 Eu em qualquer lugar|📍 Ich überall|📍 Moi partout|📍 Her yerde ben|📍 أنا في أي مكان|📍 मैं कहीं भी|📍 Aku di mana saja'),
  friends: tr('👯 With friends|👯 С друзьями|👯 З друзями|👯 Con amigos|👯 Com amigos|👯 Mit Freunden|👯 Entre amis|👯 Arkadaşlarla|👯 مع الأصدقاء|👯 दोस्तों के साथ|👯 Bareng teman'),
  greeting: tr('🎉 Greetings & cards|🎉 Поздравления|🎉 Привітання|🎉 Felicitaciones|🎉 Felicitações|🎉 Grüße & Karten|🎉 Vœux & cartes|🎉 Tebrikler|🎉 تهاني وبطاقات|🎉 बधाई और कार्ड|🎉 Ucapan & kartu'),
  fx: tr('💥 Physics FX|💥 Физика-эффекты|💥 Фізика-ефекти|💥 Efectos físicos|💥 Efeitos físicos|💥 Physik-FX|💥 Effets physiques|💥 Fizik efektleri|💥 مؤثرات فيزيائية|💥 फिज़िक्स इफेक्ट|💥 Efek fisika'),
  dance: tr('💃 Dances|💃 Танцы|💃 Танці|💃 Bailes|💃 Danças|💃 Tänze|💃 Danses|💃 Danslar|💃 رقصات|💃 डांस|💃 Tarian'),
  couple: tr('💞 Couples & besties|💞 Пары и друзья|💞 Пари та друзі|💞 Parejas y amigos|💞 Casais e amigos|💞 Paare & Freunde|💞 Couples & potes|💞 Çiftler & kankalar|💞 أزواج وأصدقاء|💞 कपल्स और दोस्त|💞 Pasangan & sahabat'),
  season: tr('🎃 Holidays & seasons|🎃 Праздники и сезоны|🎃 Свята та сезони|🎃 Fiestas y temporadas|🎃 Festas e estações|🎃 Feiertage & Saisons|🎃 Fêtes & saisons|🎃 Bayramlar & sezonlar|🎃 مناسبات ومواسم|🎃 त्योहार और मौसम|🎃 Hari raya & musim'),
  niche: tr('💼 For your niche|💼 Для вашей ниши|💼 Для вашої ніші|💼 Para tu nicho|💼 Para seu nicho|💼 Für deine Nische|💼 Pour ta niche|💼 Nişin için|💼 لمجالك|💼 आपकी निश के लिए|💼 Untuk nichemu'),
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
const ORDER = ['viral', 'fx', 'dance', 'funny', 'couple', 'season', 'avatar', 'toys', 'transform', 'place', 'friends', 'greeting', 'movie', 'niche'];
const G2 = Object.fromEntries([...ORDER.filter(k => GROUPS[k]), ...Object.keys(GROUPS).filter(k => !ORDER.includes(k))].map(k => [k, GROUPS[k]]));
fs.writeFileSync('server/templates.json', JSON.stringify({ version: 3, updated: '2026-11-05', groups: G2, templates: T, challenges: CHALLENGES }, null, 1));
console.log(T.length, 'templates');
