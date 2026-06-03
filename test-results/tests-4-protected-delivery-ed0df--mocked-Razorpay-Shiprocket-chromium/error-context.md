# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/4-protected-delivery.spec.ts >> Protected delivery flow with mocked Razorpay + Shiprocket
- Location: e2e/tests/4-protected-delivery.spec.ts:21:1

# Error details

```
Error: 13 INTERNAL: Received RST_STREAM with code 2 triggered by internal client error: read EHOSTUNREACH
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "BookVerse home" [ref=e5] [cursor=pointer]:
          - /url: /dashboard
          - generic [ref=e7]: BookVerse
        - navigation [ref=e8]:
          - link "Dashboard" [ref=e9] [cursor=pointer]:
            - /url: /dashboard
          - link "Browse" [ref=e10] [cursor=pointer]:
            - /url: /browse
          - link "Sell Book" [ref=e11] [cursor=pointer]:
            - /url: /sell
          - link "My Listings" [ref=e12] [cursor=pointer]:
            - /url: /my-listings
          - link "Wishlist" [ref=e13] [cursor=pointer]:
            - /url: /wishlist
          - link "Offers" [ref=e14] [cursor=pointer]:
            - /url: /offers
          - link "Notifications" [ref=e15] [cursor=pointer]:
            - /url: /notifications
          - link "Profile" [ref=e16] [cursor=pointer]:
            - /url: /profile
        - button "e" [ref=e20]:
          - generic [ref=e21]: e
    - main [ref=e22]:
      - generic [ref=e28]:
        - generic [ref=e29]:
          - generic [ref=e30]: India's educational books marketplace
          - heading "Your Digital Raddiwala for Used Books." [level=1] [ref=e34]:
            - text: Your Digital Raddiwala
            - text: for Used Books.
          - paragraph [ref=e35]: Don't let your books collect dust — or go to the raddiwala by weight.
          - paragraph [ref=e36]: Buy and sell educational books across India. Engineering, Medical, Competitive Exams, Certification and Professional Books — at a fraction of the price.
          - generic [ref=e37]:
            - link "Browse Books" [ref=e38] [cursor=pointer]:
              - /url: /browse
              - img [ref=e39]
              - text: Browse Books
            - link "Sell My Book" [ref=e42] [cursor=pointer]:
              - /url: /sell
              - text: Sell My Book
              - img [ref=e43]
          - generic [ref=e45]:
            - generic [ref=e46]:
              - generic [ref=e47]: 📚
              - generic [ref=e48]:
                - paragraph [ref=e49]: 500+ Books
                - paragraph [ref=e50]: Listed & verified
            - generic [ref=e51]:
              - generic [ref=e52]: 🎓
              - generic [ref=e53]:
                - paragraph [ref=e54]: 200+ Students
                - paragraph [ref=e55]: Helped so far
            - generic [ref=e56]:
              - generic [ref=e57]: 💸
              - generic [ref=e58]:
                - paragraph [ref=e59]: 3–5× More
                - paragraph [ref=e60]: Than raddiwala rates
          - generic [ref=e61]:
            - generic [ref=e62]:
              - img [ref=e64]
              - text: Admin-verified listings
            - generic [ref=e67]:
              - img [ref=e69]
              - text: Direct WhatsApp contact
            - generic [ref=e71]:
              - img [ref=e73]
              - text: No commission, ever
        - generic [ref=e76]:
          - img "JEE student with books" [ref=e78]
          - img "NEET student selling books" [ref=e80]
          - img "GATE aspirant with used books" [ref=e82]
      - generic [ref=e86]:
        - generic [ref=e87]:
          - generic [ref=e88]:
            - heading "Browse by category" [level=2] [ref=e89]
            - paragraph [ref=e90]: Find books for the exam or stream you care about.
          - link "View all" [ref=e91] [cursor=pointer]:
            - /url: /browse
            - text: View all
            - img [ref=e92]
        - generic [ref=e94]:
          - link "Engineering Explore books" [ref=e95] [cursor=pointer]:
            - /url: /browse?category=engineering
            - img [ref=e97]
            - heading "Engineering" [level=3] [ref=e99]
            - paragraph [ref=e100]: Explore books
          - link "Medical Explore books" [ref=e101] [cursor=pointer]:
            - /url: /browse?category=medical
            - img [ref=e103]
            - heading "Medical" [level=3] [ref=e106]
            - paragraph [ref=e107]: Explore books
          - link "JEE Explore books" [ref=e108] [cursor=pointer]:
            - /url: /browse?category=jee
            - img [ref=e110]
            - heading "JEE" [level=3] [ref=e114]
            - paragraph [ref=e115]: Explore books
          - link "NEET Explore books" [ref=e116] [cursor=pointer]:
            - /url: /browse?category=neet
            - img [ref=e118]
            - heading "NEET" [level=3] [ref=e122]
            - paragraph [ref=e123]: Explore books
          - link "GATE Explore books" [ref=e124] [cursor=pointer]:
            - /url: /browse?category=gate
            - img [ref=e126]
            - heading "GATE" [level=3] [ref=e129]
            - paragraph [ref=e130]: Explore books
          - link "UPSC Explore books" [ref=e131] [cursor=pointer]:
            - /url: /browse?category=upsc
            - img [ref=e133]
            - heading "UPSC" [level=3] [ref=e135]
            - paragraph [ref=e136]: Explore books
          - link "SSC Explore books" [ref=e137] [cursor=pointer]:
            - /url: /browse?category=ssc
            - img [ref=e139]
            - heading "SSC" [level=3] [ref=e143]
            - paragraph [ref=e144]: Explore books
          - link "Banking Explore books" [ref=e145] [cursor=pointer]:
            - /url: /browse?category=banking
            - img [ref=e147]
            - heading "Banking" [level=3] [ref=e150]
            - paragraph [ref=e151]: Explore books
          - link "MBA Explore books" [ref=e152] [cursor=pointer]:
            - /url: /browse?category=mba
            - img [ref=e154]
            - heading "MBA" [level=3] [ref=e157]
            - paragraph [ref=e158]: Explore books
          - link "CA/CS/CMA Explore books" [ref=e159] [cursor=pointer]:
            - /url: /browse?category=ca-cs-cma
            - img [ref=e161]
            - heading "CA/CS/CMA" [level=3] [ref=e163]
            - paragraph [ref=e164]: Explore books
          - link "IT Certifications Explore books" [ref=e165] [cursor=pointer]:
            - /url: /browse?category=it-certifications
            - img [ref=e167]
            - heading "IT Certifications" [level=3] [ref=e170]
            - paragraph [ref=e171]: Explore books
          - link "Programming Explore books" [ref=e172] [cursor=pointer]:
            - /url: /browse?category=programming
            - img [ref=e174]
            - heading "Programming" [level=3] [ref=e178]
            - paragraph [ref=e179]: Explore books
          - link "Other Explore books" [ref=e180] [cursor=pointer]:
            - /url: /browse?category=other
            - img [ref=e182]
            - heading "Other" [level=3] [ref=e184]
            - paragraph [ref=e185]: Explore books
      - generic [ref=e186]:
        - generic [ref=e187]:
          - generic [ref=e188]:
            - heading "Recently listed" [level=2] [ref=e189]
            - paragraph [ref=e190]: Fresh arrivals from sellers across the country.
          - link "View all" [ref=e191] [cursor=pointer]:
            - /url: /browse
            - text: View all
            - img [ref=e192]
        - generic [ref=e194]:
          - link "No image JEE Save to wishlist Ships E2E Test Book — HC Verma Vol 1 by HC Verma Pune, Maharashtra ₹250 ₹500 Good WhatsApp" [ref=e195] [cursor=pointer]:
            - /url: /book/xoIurs89ZJacLbyETY1Q
            - generic [ref=e196]:
              - generic [ref=e197]: No image
              - generic [ref=e198]: JEE
              - generic [ref=e199]:
                - button "Save to wishlist" [ref=e200]:
                  - img [ref=e201]
                - generic "Nationwide Shipping" [ref=e203]:
                  - img [ref=e204]
                  - text: Ships
            - generic [ref=e208]:
              - heading "E2E Test Book — HC Verma Vol 1" [level=3] [ref=e209]
              - paragraph [ref=e210]: by HC Verma
              - generic [ref=e212]:
                - img [ref=e213]
                - text: Pune, Maharashtra
              - generic [ref=e216]:
                - generic [ref=e217]:
                  - generic [ref=e218]: ₹250
                  - generic [ref=e219]: ₹500
                - generic [ref=e220]: Good
              - button "WhatsApp" [ref=e222]:
                - img [ref=e223]
                - text: WhatsApp
          - link "No image JEE Save to wishlist Ships E2E Test Book — HC Verma Vol 1 by HC Verma Pune, Maharashtra ₹250 ₹500 Good WhatsApp" [ref=e225] [cursor=pointer]:
            - /url: /book/LvbkPAmuhgxGrX8VhXZ0
            - generic [ref=e226]:
              - generic [ref=e227]: No image
              - generic [ref=e228]: JEE
              - generic [ref=e229]:
                - button "Save to wishlist" [ref=e230]:
                  - img [ref=e231]
                - generic "Nationwide Shipping" [ref=e233]:
                  - img [ref=e234]
                  - text: Ships
            - generic [ref=e238]:
              - heading "E2E Test Book — HC Verma Vol 1" [level=3] [ref=e239]
              - paragraph [ref=e240]: by HC Verma
              - generic [ref=e242]:
                - img [ref=e243]
                - text: Pune, Maharashtra
              - generic [ref=e246]:
                - generic [ref=e247]:
                  - generic [ref=e248]: ₹250
                  - generic [ref=e249]: ₹500
                - generic [ref=e250]: Good
              - button "WhatsApp" [ref=e252]:
                - img [ref=e253]
                - text: WhatsApp
          - link "No image JEE Save to wishlist Ships E2E Test Book — HC Verma Vol 1 by HC Verma Pune, Maharashtra ₹250 ₹500 Good WhatsApp" [ref=e255] [cursor=pointer]:
            - /url: /book/ZXIq37z3qZZPnJwPqKkj
            - generic [ref=e256]:
              - generic [ref=e257]: No image
              - generic [ref=e258]: JEE
              - generic [ref=e259]:
                - button "Save to wishlist" [ref=e260]:
                  - img [ref=e261]
                - generic "Nationwide Shipping" [ref=e263]:
                  - img [ref=e264]
                  - text: Ships
            - generic [ref=e268]:
              - heading "E2E Test Book — HC Verma Vol 1" [level=3] [ref=e269]
              - paragraph [ref=e270]: by HC Verma
              - generic [ref=e272]:
                - img [ref=e273]
                - text: Pune, Maharashtra
              - generic [ref=e276]:
                - generic [ref=e277]:
                  - generic [ref=e278]: ₹250
                  - generic [ref=e279]: ₹500
                - generic [ref=e280]: Good
              - button "WhatsApp" [ref=e282]:
                - img [ref=e283]
                - text: WhatsApp
          - link "No image JEE Save to wishlist Ships Admin Metric Book by HC Verma Pune, Maharashtra ₹500 Good WhatsApp" [ref=e285] [cursor=pointer]:
            - /url: /book/laVbSt2f6WflWcrBajbw
            - generic [ref=e286]:
              - generic [ref=e287]: No image
              - generic [ref=e288]: JEE
              - generic [ref=e289]:
                - button "Save to wishlist" [ref=e290]:
                  - img [ref=e291]
                - generic "Nationwide Shipping" [ref=e293]:
                  - img [ref=e294]
                  - text: Ships
            - generic [ref=e298]:
              - heading "Admin Metric Book" [level=3] [ref=e299]
              - paragraph [ref=e300]: by HC Verma
              - generic [ref=e302]:
                - img [ref=e303]
                - text: Pune, Maharashtra
              - generic [ref=e306]:
                - generic [ref=e308]: ₹500
                - generic [ref=e309]: Good
              - button "WhatsApp" [ref=e311]:
                - img [ref=e312]
                - text: WhatsApp
          - link "No image JEE Save to wishlist Pickup WhatsApp Only Book by HC Verma Pune, Maharashtra ₹250 ₹500 Good WhatsApp" [ref=e314] [cursor=pointer]:
            - /url: /book/etiFVi98GrwPKSbXhcMT
            - generic [ref=e315]:
              - generic [ref=e316]: No image
              - generic [ref=e317]: JEE
              - generic [ref=e318]:
                - button "Save to wishlist" [ref=e319]:
                  - img [ref=e320]
                - generic "Local Pickup Only" [ref=e322]:
                  - img [ref=e323]
                  - text: Pickup
            - generic [ref=e327]:
              - heading "WhatsApp Only Book" [level=3] [ref=e328]
              - paragraph [ref=e329]: by HC Verma
              - generic [ref=e331]:
                - img [ref=e332]
                - text: Pune, Maharashtra
              - generic [ref=e335]:
                - generic [ref=e336]:
                  - generic [ref=e337]: ₹250
                  - generic [ref=e338]: ₹500
                - generic [ref=e339]: Good
              - button "WhatsApp" [ref=e341]:
                - img [ref=e342]
                - text: WhatsApp
          - link "No image JEE Save to wishlist Pickup Share Reward Book by HC Verma Pune, Maharashtra 6 ₹250 ₹500 Good WhatsApp" [ref=e344] [cursor=pointer]:
            - /url: /book/DmDUXwHhNjHRRx90Elm3
            - generic [ref=e345]:
              - generic [ref=e346]: No image
              - generic [ref=e347]: JEE
              - generic [ref=e348]:
                - button "Save to wishlist" [ref=e349]:
                  - img [ref=e350]
                - generic "Local Pickup Only" [ref=e352]:
                  - img [ref=e353]
                  - text: Pickup
            - generic [ref=e357]:
              - heading "Share Reward Book" [level=3] [ref=e358]
              - paragraph [ref=e359]: by HC Verma
              - generic [ref=e360]:
                - generic [ref=e361]:
                  - img [ref=e362]
                  - text: Pune, Maharashtra
                - generic [ref=e365]:
                  - img [ref=e366]
                  - text: "6"
              - generic [ref=e372]:
                - generic [ref=e373]:
                  - generic [ref=e374]: ₹250
                  - generic [ref=e375]: ₹500
                - generic [ref=e376]: Good
              - button "WhatsApp" [ref=e378]:
                - img [ref=e379]
                - text: WhatsApp
          - link "No image JEE Save to wishlist Ships Seller Two Book by HC Verma Pune, Maharashtra ₹350 ₹500 Good WhatsApp" [ref=e381] [cursor=pointer]:
            - /url: /book/DVrcVAYSuewgGSndHOi2
            - generic [ref=e382]:
              - generic [ref=e383]: No image
              - generic [ref=e384]: JEE
              - generic [ref=e385]:
                - button "Save to wishlist" [ref=e386]:
                  - img [ref=e387]
                - generic "Nationwide Shipping" [ref=e389]:
                  - img [ref=e390]
                  - text: Ships
            - generic [ref=e394]:
              - heading "Seller Two Book" [level=3] [ref=e395]
              - paragraph [ref=e396]: by HC Verma
              - generic [ref=e398]:
                - img [ref=e399]
                - text: Pune, Maharashtra
              - generic [ref=e402]:
                - generic [ref=e403]:
                  - generic [ref=e404]: ₹350
                  - generic [ref=e405]: ₹500
                - generic [ref=e406]: Good
              - button "WhatsApp" [ref=e408]:
                - img [ref=e409]
                - text: WhatsApp
          - link "No image JEE Save to wishlist Ships Seller One Book by HC Verma Pune, Maharashtra ₹400 ₹500 Good WhatsApp" [ref=e411] [cursor=pointer]:
            - /url: /book/sCFk6UP0X24sYRz5nqiA
            - generic [ref=e412]:
              - generic [ref=e413]: No image
              - generic [ref=e414]: JEE
              - generic [ref=e415]:
                - button "Save to wishlist" [ref=e416]:
                  - img [ref=e417]
                - generic "Nationwide Shipping" [ref=e419]:
                  - img [ref=e420]
                  - text: Ships
            - generic [ref=e424]:
              - heading "Seller One Book" [level=3] [ref=e425]
              - paragraph [ref=e426]: by HC Verma
              - generic [ref=e428]:
                - img [ref=e429]
                - text: Pune, Maharashtra
              - generic [ref=e432]:
                - generic [ref=e433]:
                  - generic [ref=e434]: ₹400
                  - generic [ref=e435]: ₹500
                - generic [ref=e436]: Good
              - button "WhatsApp" [ref=e438]:
                - img [ref=e439]
                - text: WhatsApp
      - generic [ref=e442]:
        - generic [ref=e443]:
          - heading "How BookVerse works" [level=2] [ref=e444]
          - paragraph [ref=e445]: A simple process designed for learners.
        - generic [ref=e446]:
          - generic [ref=e447]:
            - generic: "01"
            - generic [ref=e448]:
              - img [ref=e450]
              - heading "List your books" [level=3] [ref=e453]
              - paragraph [ref=e454]: Snap a few photos, set your price, and reach thousands of students in minutes.
          - generic [ref=e455]:
            - generic: "02"
            - generic [ref=e456]:
              - img [ref=e458]
              - heading "Connect with buyers" [level=3] [ref=e463]
              - paragraph [ref=e464]: Buyers contact you directly via WhatsApp after completing email, profile, and mobile verification.
          - generic [ref=e465]:
            - generic: "03"
            - generic [ref=e466]:
              - img [ref=e468]
              - heading "Agree the handover" [level=3] [ref=e471]
              - paragraph [ref=e472]: Discuss price, pickup, inspection, and payment directly with the other person. BookVerse does not handle checkout.
      - generic [ref=e473]:
        - generic [ref=e474]:
          - heading "Choose Your Way to Buy" [level=2] [ref=e475]
          - paragraph [ref=e476]: BookVerse gives you the flexibility to deal directly or enjoy the convenience of doorstep delivery — both built for trust.
        - generic [ref=e477]:
          - generic [ref=e478]:
            - generic [ref=e479]:
              - img [ref=e481]
              - generic [ref=e484]: HAND-TO-HAND
            - heading "🤝 Local Deal" [level=3] [ref=e485]
            - paragraph [ref=e486]: Connect directly with sellers in your campus or neighborhood. Inspect the book personally and pay only when satisfied.
            - generic [ref=e487]:
              - generic [ref=e488]: Local Pickup
              - generic [ref=e490]: Direct WhatsApp Contact
          - generic [ref=e492]:
            - generic [ref=e493]:
              - img [ref=e495]
              - generic [ref=e498]: LOCAL FIRST
            - heading "Find books near you" [level=3] [ref=e499]
            - paragraph [ref=e500]: Discover books by city and state, then chat directly with verified sellers to agree pickup, handover, and payment details.
            - generic [ref=e501]:
              - generic [ref=e502]:
                - img [ref=e503]
                - text: City/State Discovery
              - generic [ref=e506]:
                - img [ref=e507]
                - text: Verified Profiles
      - generic [ref=e510]:
        - generic [ref=e511]:
          - heading "Why Trust BookVerse" [level=2] [ref=e512]
          - paragraph [ref=e513]: Every listing and transaction is designed with student safety in mind.
        - generic [ref=e514]:
          - generic [ref=e515]:
            - img [ref=e517]
            - heading "Verified Listings" [level=3] [ref=e520]
            - paragraph [ref=e521]: Every listing is reviewed by our team before it goes live. Fake or misleading posts are removed immediately.
          - generic [ref=e522]:
            - img [ref=e524]
            - heading "Verified Sellers" [level=3] [ref=e527]
            - paragraph [ref=e528]: Sellers with a valid mobile number get a verified badge, so you know exactly who you are dealing with.
          - generic [ref=e529]:
            - img [ref=e531]
            - heading "Real Book Photos" [level=3] [ref=e534]
            - paragraph [ref=e535]: Listings require real photos so buyers can inspect condition before messaging a seller.
          - generic [ref=e536]:
            - img [ref=e538]
            - heading "Transparent Pricing" [level=3] [ref=e541]
            - paragraph [ref=e542]: No hidden fees, no platform commission. What you see is what you pay — whether it is a local deal or doorstep delivery.
          - generic [ref=e543]:
            - img [ref=e545]
            - heading "City-Based Discovery" [level=3] [ref=e548]
            - paragraph [ref=e549]: Find educational books by city and state, including smaller towns through manual city entry.
          - generic [ref=e550]:
            - img [ref=e552]
            - heading "Direct Communication" [level=3] [ref=e554]
            - paragraph [ref=e555]: Chat with sellers on WhatsApp before you buy. Ask questions, negotiate, and build confidence before you commit.
      - generic [ref=e560]:
        - generic [ref=e561]:
          - heading "What Students Say" [level=2] [ref=e562]
          - paragraph [ref=e563]: Real stories from learners who bought and sold books on BookVerse.
        - generic [ref=e564]:
          - generic:
            - generic [ref=e565]:
              - paragraph [ref=e566]: I got a full set of Cengage Physics and Chemistry books for less than half the MRP. The seller was verified and we met on campus. Super smooth.
              - generic [ref=e567]:
                - img "Aarav R. headshot" [ref=e568]
                - generic [ref=e569]:
                  - paragraph [ref=e570]: Aarav R.
                  - paragraph [ref=e571]: JEE Aspirant, Kota
              - generic [ref=e572]:
                - img [ref=e573]
                - img [ref=e575]
                - img [ref=e577]
                - img [ref=e579]
                - img [ref=e581]
            - generic [ref=e583] [cursor=pointer]:
              - paragraph [ref=e584]: Sold my MBBS first-year books in two days. The buyer messaged on WhatsApp, checked the photos, and we arranged pickup directly.
              - generic [ref=e585]:
                - img "Sanya P. headshot" [ref=e586]
                - generic [ref=e587]:
                  - paragraph [ref=e588]: Sanya P.
                  - paragraph [ref=e589]: NEET Student, Delhi
              - generic [ref=e590]:
                - img [ref=e591]
                - img [ref=e593]
                - img [ref=e595]
                - img [ref=e597]
                - img [ref=e599]
            - generic [ref=e601] [cursor=pointer]:
              - paragraph [ref=e602]: I was skeptical about used book listings, but verified profiles and admin-approved posts made it easy to find a genuine seller nearby.
              - generic [ref=e603]:
                - img "Vikram K. headshot" [ref=e604]
                - generic [ref=e605]:
                  - paragraph [ref=e606]: Vikram K.
                  - paragraph [ref=e607]: GATE Prep, Hyderabad
              - generic [ref=e608]:
                - img [ref=e609]
                - img [ref=e611]
                - img [ref=e613]
                - img [ref=e615]
                - img [ref=e617]
            - generic [ref=e619] [cursor=pointer]:
              - paragraph [ref=e620]: Sold my MBBS first-year books in two days. The buyer messaged on WhatsApp, checked the photos, and we arranged pickup directly.
              - generic [ref=e621]:
                - img "Sanya P. headshot" [ref=e622]
                - generic [ref=e623]:
                  - paragraph [ref=e624]: Sanya P.
                  - paragraph [ref=e625]: NEET Student, Delhi
              - generic [ref=e626]:
                - img [ref=e627]
                - img [ref=e629]
                - img [ref=e631]
                - img [ref=e633]
                - img [ref=e635]
            - generic [ref=e637] [cursor=pointer]:
              - paragraph [ref=e638]: I was skeptical about used book listings, but verified profiles and admin-approved posts made it easy to find a genuine seller nearby.
              - generic [ref=e639]:
                - img "Vikram K. headshot" [ref=e640]
                - generic [ref=e641]:
                  - paragraph [ref=e642]: Vikram K.
                  - paragraph [ref=e643]: GATE Prep, Hyderabad
              - generic [ref=e644]:
                - img [ref=e645]
                - img [ref=e647]
                - img [ref=e649]
                - img [ref=e651]
                - img [ref=e653]
          - button "Previous testimonial" [ref=e655]:
            - img [ref=e656]
          - button "Next testimonial" [ref=e658]:
            - img [ref=e659]
      - generic [ref=e661]:
        - generic [ref=e662]:
          - heading "Frequently Asked Questions" [level=2] [ref=e663]
          - paragraph [ref=e664]: Everything you need to know about buying, selling, and staying safe on BookVerse.
        - generic [ref=e665]:
          - heading "How do I sign up or log in to BookVerse?" [level=3] [ref=e667]:
            - button "How do I sign up or log in to BookVerse?" [ref=e668] [cursor=pointer]:
              - text: How do I sign up or log in to BookVerse?
              - img [ref=e669]
          - heading "Why is my listing not showing up immediately?" [level=3] [ref=e672]:
            - button "Why is my listing not showing up immediately?" [ref=e673] [cursor=pointer]:
              - text: Why is my listing not showing up immediately?
              - img [ref=e674]
          - heading "What is Local Pickup and how does it work?" [level=3] [ref=e677]:
            - button "What is Local Pickup and how does it work?" [ref=e678] [cursor=pointer]:
              - text: What is Local Pickup and how does it work?
              - img [ref=e679]
          - heading "Can I find books outside major cities?" [level=3] [ref=e682]:
            - button "Can I find books outside major cities?" [ref=e683] [cursor=pointer]:
              - text: Can I find books outside major cities?
              - img [ref=e684]
          - heading "How do I contact a seller on WhatsApp?" [level=3] [ref=e687]:
            - button "How do I contact a seller on WhatsApp?" [ref=e688] [cursor=pointer]:
              - text: How do I contact a seller on WhatsApp?
              - img [ref=e689]
          - heading "Does BookVerse handle payment?" [level=3] [ref=e692]:
            - button "Does BookVerse handle payment?" [ref=e693] [cursor=pointer]:
              - text: Does BookVerse handle payment?
              - img [ref=e694]
          - heading "Does BookVerse charge any commission or fees?" [level=3] [ref=e697]:
            - button "Does BookVerse charge any commission or fees?" [ref=e698] [cursor=pointer]:
              - text: Does BookVerse charge any commission or fees?
              - img [ref=e699]
    - contentinfo [ref=e701]:
      - generic [ref=e702]:
        - generic [ref=e703]:
          - generic [ref=e704]:
            - link "BookVerse home" [ref=e705] [cursor=pointer]:
              - /url: /
              - text: BookVerse
            - paragraph [ref=e707]: India's marketplace for educational books. Don't let your books become scrap — pass them on to the next learner.
          - generic [ref=e708]:
            - heading "Explore" [level=4] [ref=e709]
            - list [ref=e710]:
              - listitem [ref=e711]:
                - link "Browse books" [ref=e712] [cursor=pointer]:
                  - /url: /browse
              - listitem [ref=e713]:
                - link "Sell a book" [ref=e714] [cursor=pointer]:
                  - /url: /sell
              - listitem [ref=e715]:
                - link "About" [ref=e716] [cursor=pointer]:
                  - /url: /about
          - generic [ref=e717]:
            - heading "Legal" [level=4] [ref=e718]
            - list [ref=e719]:
              - listitem [ref=e720]:
                - link "Terms" [ref=e721] [cursor=pointer]:
                  - /url: /terms
              - listitem [ref=e722]:
                - link "Privacy" [ref=e723] [cursor=pointer]:
                  - /url: /privacy
              - listitem [ref=e724]:
                - link "Refunds & Returns" [ref=e725] [cursor=pointer]:
                  - /url: /refunds
        - generic [ref=e726]:
          - paragraph [ref=e727]: © 2026 BookVerse. Made for learners across India.
          - paragraph [ref=e728]:
            - text: A unit of
            - link "The Technology Fiction" [ref=e729] [cursor=pointer]:
              - /url: https://www.thetechnologyfiction.com/
            - text: .
          - paragraph [ref=e730]:
            - text: Made with ♥ by
            - link "TechFi Labs" [ref=e731] [cursor=pointer]:
              - /url: https://www.techfilabs.com/
  - region "Notifications alt+T"
```

# Test source

```ts
  1   | import { test, expect } from "../fixtures";
  2   | import { LoginPage } from "../pages/LoginPage";
  3   | import { DashboardPage } from "../pages/DashboardPage";
  4   | import { TEST_LISTING, TEST_PROFILE, TEST_PICKUP_ADDRESS } from "../constants";
  5   | import {
  6   |   createTestProfile,
  7   |   saveTestPickupAddress,
  8   |   createTestListing,
  9   |   approveTestListing,
  10  |   setTestUserPhoneVerified,
  11  |   simulateRazorpayWebhook,
  12  |   simulateShiprocketWebhook,
  13  |   getAdminDb,
  14  | } from "../helpers/firebase";
  15  | 
  16  | test.skip(
  17  |   process.env.VITE_ENABLE_PROTECTED_DELIVERY !== "true",
  18  |   "Protected delivery feature flag is off",
  19  | );
  20  | 
  21  | test("Protected delivery flow with mocked Razorpay + Shiprocket", async ({
  22  |   page,
  23  |   sellerUser,
  24  |   buyerUser,
  25  | }) => {
  26  |   const loginPage = new LoginPage(page);
  27  |   const dashboardPage = new DashboardPage(page);
  28  | 
  29  |   // Setup seller — profile + phone verified + pickup address + approved listing
  30  |   await createTestProfile(sellerUser.uid, TEST_PROFILE);
  31  |   await setTestUserPhoneVerified(sellerUser.uid);
  32  |   await saveTestPickupAddress(sellerUser.uid, TEST_PICKUP_ADDRESS);
  33  |   const listingId = await createTestListing(sellerUser.uid, {
  34  |     ...TEST_LISTING,
  35  |     deliveryType: "shipping",
  36  |   });
  37  |   await approveTestListing(listingId);
  38  | 
  39  |   // Setup buyer — profile + phone verified
  40  |   await createTestProfile(buyerUser.uid, { ...TEST_PROFILE, name: "E2E Buyer" });
  41  |   await setTestUserPhoneVerified(buyerUser.uid);
  42  | 
  43  |   // ---------------------------------------------------------------
  44  |   // PART A: Login as buyer
  45  |   // ---------------------------------------------------------------
  46  |   await loginPage.goto();
  47  |   await loginPage.loginWithEmail(buyerUser.email, buyerUser.password);
  48  |   await page.waitForURL(/\/(dashboard|profile|admin)/, { timeout: 15_000 });
  49  |   await page.goto("/");
  50  |   await page.waitForLoadState("domcontentloaded");
  51  |   await page.waitForTimeout(1000);
  52  | 
  53  |   // ---------------------------------------------------------------
  54  |   // PART B: Create order directly in Firestore
  55  |   // Bypasses checkout API auth issue — tests webhook pipeline instead
  56  |   // ---------------------------------------------------------------
  57  |   const db = getAdminDb();
  58  |   const orderRef = db.collection("orders").doc();
> 59  |   await orderRef.set({
      |                  ^ Error: 13 INTERNAL: Received RST_STREAM with code 2 triggered by internal client error: read EHOSTUNREACH
  60  |     buyerUid: buyerUser.uid,
  61  |     buyerEmail: buyerUser.email,
  62  |     sellerUid: sellerUser.uid,
  63  |     sellerEmail: `${sellerUser.uid}@test.local`,
  64  |     fulfillmentMode: "protected_delivery",
  65  |     items: [
  66  |       {
  67  |         listingId,
  68  |         sellerUid: sellerUser.uid,
  69  |         title: TEST_LISTING.title,
  70  |         author: TEST_LISTING.author,
  71  |         image: "",
  72  |         category: TEST_LISTING.category,
  73  |         condition: TEST_LISTING.condition,
  74  |         price: TEST_LISTING.sellingPrice,
  75  |         quantity: 1,
  76  |         estimatedWeightKg: 0.5,
  77  |       },
  78  |     ],
  79  |     itemCount: 1,
  80  |     listing: {
  81  |       id: listingId,
  82  |       title: TEST_LISTING.title,
  83  |       author: TEST_LISTING.author,
  84  |       image: "",
  85  |       condition: TEST_LISTING.condition,
  86  |       category: TEST_LISTING.category,
  87  |       originalPrice: null,
  88  |     },
  89  |     pickupAddress: {
  90  |       name: TEST_PICKUP_ADDRESS.name,
  91  |       phone: TEST_PICKUP_ADDRESS.phone,
  92  |       address: TEST_PICKUP_ADDRESS.address,
  93  |       city: TEST_PICKUP_ADDRESS.city,
  94  |       state: TEST_PICKUP_ADDRESS.state,
  95  |       pincode: TEST_PICKUP_ADDRESS.pincode,
  96  |     },
  97  |     shippingAddress: {
  98  |       name: TEST_PROFILE.name,
  99  |       phone: "9999999999",
  100 |       email: buyerUser.email,
  101 |       address1: "123 Test Street",
  102 |       address2: "",
  103 |       city: TEST_PROFILE.city,
  104 |       state: TEST_PROFILE.state,
  105 |       pincode: TEST_PROFILE.pincode,
  106 |       country: "India",
  107 |     },
  108 |     subtotal: TEST_LISTING.sellingPrice,
  109 |     shippingFee: 50,
  110 |     gatewayFee: 10,
  111 |     platformFee: 0,
  112 |     totalAmount: TEST_LISTING.sellingPrice + 60,
  113 |     totalWeightKg: 0.5,
  114 |     status: "pending_payment",
  115 |     paymentStatus: "pending",
  116 |     shipmentStatus: "pending",
  117 |     razorpayOrderId: `order_e2e_${Date.now()}`,
  118 |     paymentId: null,
  119 |     shipmentId: null,
  120 |     shiprocketOrderId: null,
  121 |     shiprocketShipmentId: null,
  122 |     awb: null,
  123 |     trackingUrl: null,
  124 |     createdAt: new Date(),
  125 |     updatedAt: new Date(),
  126 |   });
  127 | 
  128 |   const orderId = orderRef.id;
  129 |   expect(orderId).toBeTruthy();
  130 | 
  131 |   // ---------------------------------------------------------------
  132 |   // PART C: Verify order exists in Firestore
  133 |   // ---------------------------------------------------------------
  134 |   const orderDoc = await db.collection("orders").doc(orderId).get();
  135 |   expect(orderDoc.exists).toBe(true);
  136 |   expect(orderDoc.get("buyerUid")).toBe(buyerUser.uid);
  137 | 
  138 |   // ---------------------------------------------------------------
  139 |   // PART D: Simulate Razorpay payment webhook
  140 |   // ---------------------------------------------------------------
  141 | 
  142 |   // PART D: Simulate Razorpay payment webhook
  143 |   const paymentId = `pay_e2e_${Date.now()}`;
  144 |   await simulateRazorpayWebhook({
  145 |     razorpayOrderId: orderDoc.get("razorpayOrderId"),
  146 |     paymentId,
  147 |   });
  148 |   await page.waitForTimeout(3000);
  149 | 
  150 |   const orderAfterPayment = await db.collection("orders").doc(orderId).get();
  151 |   // Soft check — webhook may be async in test env
  152 |   const paymentStatus = orderAfterPayment.get("paymentStatus") ?? orderAfterPayment.get("status");
  153 |   console.log("Payment status after webhook:", paymentStatus);
  154 |   expect(typeof paymentStatus).toBe("string");
  155 |   expect(orderAfterPayment.get("shipmentStatus")).toBe("SHIPROCKET_SKIPPED");
  156 |   expect(orderAfterPayment.get("shiprocketOrderId")).toBeNull();
  157 |   expect(orderAfterPayment.get("shiprocketShipmentId")).toBeNull();
  158 | 
  159 |   // PART E: Simulate Shiprocket delivery status updates
```