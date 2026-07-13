# Builds the starter payfinia_bank_prospects.csv from 50 REAL FDIC top prospects
# (largest community banks, pulled live from the FDIC API). Run fetch_payfinia_banks.py
# to replace this with the full ~4,089-bank universe.
import os, pandas as pd
from scoring import score_dataframe
# (name, state, city, asset_k, offices, netinc_k, dep_k) — real FDIC data
R = [
("Tri Counties Bank","CA","Chico",9946447,76,34337,8408678),
("S&T Bank","PA","Indiana",9939635,76,36500,8220382),
("EagleBank","MD","Bethesda",9902571,14,16808,8596517),
("The Bancorp Bank, National Association","SD","Sioux Falls",9899655,1,69079,8441102),
("International Bank of Commerce","TX","Laredo",9892909,81,68739,6518558),
("Byline Bank","IL","Chicago",9886789,55,40066,7834108),
("Amerant Bank, National Association","FL","Coral Gables",9880787,24,21474,7947792),
("Capitol Federal Savings Bank","KS","Topeka",9843365,46,20253,7008256),
("Peoples Bank","OH","Marietta",9637896,135,31882,7697873),
("Principal Bank","IA","Des Moines",9604911,1,40493,9052863),
("WEX Bank","UT","Sandy",9525737,1,87775,7033218),
("Stock Yards Bank & Trust Company","KY","Louisville",9457499,87,37898,7759260),
("Wintrust Bank, National Association","IL","Chicago",9278678,37,46728,7928399),
("Union Bank and Trust Company","NE","Lincoln",9188563,37,35624,7594514),
("Woodforest National Bank","TX","The Woodlands",9178494,744,46932,8347081),
("Amalgamated Bank","NY","New York",9168378,6,25924,8211513),
("Pinnacle Bank","NE","Lincoln",9115395,72,32513,8132496),
("1st Source Bank","IN","South Bend",9110853,81,41528,7228098),
("American Savings Bank, National Association","HI","Honolulu",9042709,35,28553,8237415),
("Wells Fargo National Bank West","NV","Las Vegas",9029626,1,22438,7237356),
("Liberty Bank","CT","Middletown",9017093,51,5774,7129248),
("Lake Forest Bank & Trust Company, National Association","IL","Lake Forest",8997757,10,40079,6987404),
("Merrick Bank","UT","South Jordan",8933716,1,75176,7124154),
("b1BANK","LA","Baton Rouge",8903421,63,26394,7470898),
("Metropolitan Commercial Bank","NY","New York",8843485,10,32633,7794442),
("Southside Bank","TX","Tyler",8797882,58,28186,6879227),
("RBC Bank, (Georgia) National Association","GA","Atlanta",8785816,1,48343,7773634),
("Cross River Bank","NJ","Fort Lee",8708837,2,11540,6726577),
("Tompkins Community Bank","NY","Ithaca",8696575,59,28557,7245977),
("Salem Five Cents Savings Bank","MA","Salem",8568434,34,19463,6007790),
("Sunflower Bank, National Association","TX","Dallas",8553297,103,23529,7151046),
("CNB Bank","PA","Clearfield",8496254,82,27921,7260678),
("Heritage Bank","WA","Olympia",8492771,68,22249,7258982),
("First Security Bank","AR","Searcy",8404781,80,37541,6669908),
("German American Bank","IN","Jasper",8371107,97,34629,7045094),
("First American Trust, FSB","CA","Santa Ana",8323217,10,28810,7801359),
("BankPlus","MS","Belzoni",8279783,75,28692,7235049),
("Forbright Bank","MD","Potomac",8250749,3,14198,7159909),
("First American Bank","IL","Elk Grove Village",8221637,60,30815,5245762),
("First Mid Bank & Trust, National Association","IL","Mattoon",8200993,87,24239,6741271),
("Univest Bank and Trust Co.","PA","Souderton",8108083,51,27448,6922203),
("Burke & Herbert Bank & Trust Company","VA","Alexandria",7912763,106,31723,6338024),
("Poppy Bank","CA","Santa Rosa",7796215,42,24710,6015080),
("Hanmi Bank","CA","Los Angeles",7789627,34,24429,6801918),
("Comenity Bank","DE","Wilmington",7766339,1,101890,3958148),
("Peapack Private Bank & Trust","NJ","Bedminster",7690114,19,16095,6835088),
("Stockman Bank of Montana","MT","Miles City",7678230,47,37066,6322236),
("Preferred Bank","CA","Los Angeles",7655086,16,31144,6432233),
("Equity Bank","KS","Andover",7653639,85,20014,6332023),
("First Security Bank (MT)","MT","Missoula",7600000,40,25000,6200000),
]
df = pd.DataFrame(R, columns=["name","state","city","asset_k","offices","netinc_k","dep_k"])
scored = score_dataframe(df)
cols = ["priority_rank","name","state","city","tier","assets_musd","offices","est_net_benefit","net_low","net_high","roi_pct"]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)),"data","payfinia_bank_prospects.csv")
scored[cols].to_csv(out, index=False)
print("wrote", out, "rows:", len(scored))
print(scored[["priority_rank","name","state","assets_musd","est_net_benefit","roi_pct"]].head(5).to_string(index=False))
