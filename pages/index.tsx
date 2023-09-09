// import * as React from 'react';
// import Link from 'next/link';

// const HomePage = () => {
//   return (
//     <div>
//       <h1>Welcome to the Home Page</h1>
//       <p>Select an option:</p>
//       <ul>
//         <li><Link href="/chat">Go to Chat</Link></li>
//         <li><Link href="/news">See the News</Link></li>
//         <li><Link href="/filebrowser">Go to filebrowser</Link></li>
//       </ul>
//     </div>
//   );
// }

// export default HomePage;


import * as React from 'react';
import Link from 'next/link';
import styled from 'styled-components';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #f3f4f6;
`;

const Title = styled.h1`
  color: #333;
  font-size: 2.5rem;
  margin-bottom: 20px;
`;

const OptionList = styled.ul`
  list-style: none;
  padding: 0;
  display: flex;
  gap: 20px;
`;

const OptionItem = styled.li`
  background-color: #4f46e5;
  padding: 10px 20px;
  border-radius: 5px;
  transition: background-color 0.3s;

  &:hover {
    background-color: #3b82f6;
  }
`;

const StyledLink = styled(Link)`
  color: white;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const HomePage = () => {
  return (
    <StyledContainer>
      <Title>Welcome to the Home Page</Title>
      <p>Select an option:</p>
      <OptionList>
        <OptionItem>
          <StyledLink href="/chat">Go to Chat</StyledLink>
        </OptionItem>        
        <OptionItem>
          <StyledLink href="/ChatGPT-Next-Web">Go to ChatGPT-Next-Web</StyledLink>
        </OptionItem>
        <OptionItem>
          <StyledLink href="/news">See the News</StyledLink>
        </OptionItem>        
        <OptionItem>
          <StyledLink href="/filebrowser">Go to filebrowser</StyledLink>
        </OptionItem>
      </OptionList>
    </StyledContainer>
  );
}

export default HomePage;
