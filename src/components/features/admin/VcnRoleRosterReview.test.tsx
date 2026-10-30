import { fireEvent, render, screen, within } from '@testing-library/react';
import { VcnRoleRosterReview } from './VcnRoleRosterReview';
jest.mock('../../../hooks/useMemberDirectory',()=>({
  useMemberDirectory:()=>({
    loading:false,error:null,
    members:[{id:'m1',fullName:'Sample Person',displayName:'Sample Person · Muir',year:'Fourth',college:'Muir'}],
    byId:new Map([['m1',{id:'m1',fullName:'Sample Person',displayName:'Sample Person · Muir'}]]),
  }),
}));
describe('private VCN CSV preview (#683)',()=>{
  it('requires an existing edition and never claims badge publication',()=>{
    const {rerender}=render(<VcnRoleRosterReview editionYear={null}/>);
    fireEvent.click(screen.getByRole('button',{name:/Review roster CSV/}));
    expect(screen.getByRole('button',{name:'Preview identities'})).toBeDisabled();
    rerender(<VcnRoleRosterReview editionYear={2026}/>);
    fireEvent.change(screen.getByLabelText(/Private roster CSV/),{target:{value:'name,role,status\nSample Person,Dancer,verified'}});
    fireEvent.click(screen.getByRole('button',{name:'Preview identities'}));
    const row=screen.getByText(/Row 2: Sample Person/).closest('li');
    expect(row).not.toBeNull();
    const choice=within(row!).getByLabelText('Explicit canonical member selection');
    expect(choice).toHaveValue('');
    fireEvent.change(choice,{target:{value:'m1'}});
    expect(screen.getByRole('status')).toHaveTextContent('1 identity selections');
    expect(screen.getByText(/No file, member links, points, attendance or badges are saved or published/)).toBeInTheDocument();
  });
  it('rejects missing source status instead of inventing a verified credit',()=>{
    render(<VcnRoleRosterReview editionYear={2026}/>);
    fireEvent.click(screen.getByRole('button',{name:/Review roster CSV/}));
    fireEvent.change(screen.getByLabelText(/Private roster CSV/),{target:{value:'name,role\nSample Person,Dancer'}});
    fireEvent.click(screen.getByRole('button',{name:'Preview identities'}));
    expect(screen.getByRole('alert')).toHaveTextContent(/verification\/status columns/);
  });
});
